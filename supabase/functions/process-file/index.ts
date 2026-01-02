import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { encode as encodeBase64, decode as decodeBase64 } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import JSZip from "https://esm.sh/jszip@3.10.1?target=deno";
import { createLogger } from "../_shared/logger.ts";
import { authenticateUser } from "../_shared/auth.ts";
import type { ProcessFileResponse, SubscriptionPlan } from "../_shared/response-types.ts";

// ===== SECURITY LIMITS =====
const ABSOLUTE_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB - teto absoluto de seguranca
const PROCESSING_TIMEOUT_MS = 25_000; // 25 segundos (margem para 50s limit)
const REQUIRED_XLSX_FILES = ["[Content_Types].xml"]; // Estrutura minima XLSX

// Limites por plano (espelhando validate-processing)
const PLAN_LIMITS: Record<SubscriptionPlan, { maxFileSizeMB: number | null }> = {
  free: { maxFileSizeMB: 1 },
  professional: { maxFileSizeMB: 3 },
  premium: { maxFileSizeMB: null }, // ilimitado (ate o teto de seguranca)
};

const getMaxFileSizeForPlan = (plan: SubscriptionPlan): number => {
  const limit = PLAN_LIMITS[plan]?.maxFileSizeMB;
  if (limit === null) {
    return ABSOLUTE_MAX_FILE_SIZE_BYTES;
  }
  return limit * 1024 * 1024;
};

const baseLogger = createLogger("PROCESS-FILE");

const allowedOrigins = new Set([
  "https://vbablocker.vercel.app",
  "http://localhost:8080",
]);

const MIME_XLSM = "application/vnd.ms-excel.sheet.macroEnabled.12";
const VBA_FILENAME = "xl/vbaProject.bin";
const MIN_VBA_SIZE = 100;
const ZIP_MAGIC_BYTES = [0x50, 0x4b, 0x03, 0x04];

const BINARY_PATTERNS = [
  { prefix: [67, 77, 71, 61, 34], name: "CMG" },
  { prefix: [68, 80, 66, 61, 34], name: "DPB" },
  { prefix: [71, 67, 61, 34], name: "GC" },
];

const QUOTE_BYTE = 34;
const F_BYTE = 70;

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  Uint8Array.from(bytes).buffer;

type ProcessPayload = {
  fileBase64?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
};

type UploadedFile = {
  fileBytes: Uint8Array;
  fileName: string;
  mimeType: string;
};

type ModifyVbaResult = {
  modified: Uint8Array;
  patternsFound: number;
  warnings: string[];
};

const getCorsHeaders = (origin: string | null) => {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
};

const jsonResponse = <T,>(
  body: T,
  status: number,
  corsHeaders: Record<string, string>,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const errorResponse = (
  message: string,
  status: number,
  errorCode: string,
  corsHeaders: Record<string, string>,
  requestId: string,
) => {
  const body: ProcessFileResponse = { requestId, success: false, error: message, errorCode };
  return jsonResponse(body, status, corsHeaders);
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string,
): Promise<T> => {
  let timeoutId: number | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Operation '${operation}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
};

const hasZipMagicBytes = (bytes: Uint8Array): boolean => {
  if (bytes.length < ZIP_MAGIC_BYTES.length) {
    return false;
  }
  return (
    bytes[0] === ZIP_MAGIC_BYTES[0]
    && bytes[1] === ZIP_MAGIC_BYTES[1]
    && bytes[2] === ZIP_MAGIC_BYTES[2]
    && bytes[3] === ZIP_MAGIC_BYTES[3]
  );
};

const validateXlsxStructure = (zip: JSZip): boolean => {
  // XLSX/XLSM deve conter [Content_Types].xml na raiz
  for (const requiredFile of REQUIRED_XLSX_FILES) {
    if (!zip.file(requiredFile)) {
      return false;
    }
  }
  return true;
};

const decodeBase64Payload = (payload: string): Uint8Array => {
  const normalized = payload.includes(",")
    ? payload.slice(payload.indexOf(",") + 1)
    : payload;
  return decodeBase64(normalized);
};

const parseJsonPayload = (raw: unknown): ProcessPayload => {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const record = raw as Record<string, unknown>;
  return {
    fileBase64: typeof record.fileBase64 === "string" ? record.fileBase64 : null,
    fileName: typeof record.fileName === "string" ? record.fileName : null,
    mimeType: typeof record.mimeType === "string" ? record.mimeType : null,
  };
};

const extractUpload = async (req: Request, maxFileSize: number): Promise<UploadedFile> => {
  const contentType = req.headers.get("content-type") ?? "";
  // Calcula limite base64 (base64 aumenta ~33%)
  const maxBase64Length = Math.ceil(maxFileSize * 1.4);

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new Error("Missing file");
    }
    // SECURITY: Validar tamanho ANTES de carregar na memoria
    if (file.size > maxFileSize) {
      const limitMB = (maxFileSize / 1024 / 1024).toFixed(0);
      throw new Error(`Arquivo muito grande. Limite do seu plano: ${limitMB}MB`);
    }
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const fileName = file.name || "arquivo.xlsm";
    // SECURITY: Ignorar MIME do cliente, usar sempre o esperado
    const mimeType = MIME_XLSM;
    return { fileBytes, fileName, mimeType };
  }

  if (contentType.includes("application/json")) {
    const raw = await req.json() as unknown;
    const payload = parseJsonPayload(raw);
    if (!payload.fileBase64) {
      throw new Error("Missing fileBase64");
    }
    // SECURITY: Validar tamanho do base64 ANTES de decodificar
    if (payload.fileBase64.length > maxBase64Length) {
      const limitMB = (maxFileSize / 1024 / 1024).toFixed(0);
      throw new Error(`Arquivo muito grande. Limite do seu plano: ${limitMB}MB`);
    }
    const fileBytes = decodeBase64Payload(payload.fileBase64);

    // SECURITY: Validar tamanho apos decodificacao (double-check)
    if (fileBytes.length > maxFileSize) {
      const limitMB = (maxFileSize / 1024 / 1024).toFixed(0);
      throw new Error(`Arquivo muito grande. Limite do seu plano: ${limitMB}MB`);
    }
    const fileName = payload.fileName?.trim() || "arquivo.xlsm";
    // SECURITY: Ignorar MIME do cliente
    const mimeType = MIME_XLSM;
    return { fileBytes, fileName, mimeType };
  }

  throw new Error("Unsupported content type");
};

const mapUploadError = (message: string) => {
  if (message.includes("Missing file") || message.includes("Missing fileBase64")) {
    return { status: 400, code: "MISSING_FILE" };
  }
  if (message.includes("Unsupported content type")) {
    return { status: 415, code: "UNSUPPORTED_CONTENT_TYPE" };
  }
  if (message.includes("muito grande") || message.includes("too large")) {
    return { status: 413, code: "FILE_TOO_LARGE" };
  }
  if (message.includes("timed out")) {
    return { status: 408, code: "PROCESSING_TIMEOUT" };
  }
  return { status: 400, code: "INVALID_UPLOAD" };
};

const buildFileName = (originalName: string) => {
  const baseName = originalName.replace(/\.xlsm$/i, "");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  return `${baseName}_${timestamp}.xlsm`;
};

const modifyVbaContent = (content: Uint8Array): ModifyVbaResult => {
  const result = new Uint8Array(content);
  let patternsFound = 0;
  const warnings: string[] = [];

  if (content.length < MIN_VBA_SIZE) {
    warnings.push(`Arquivo VBA muito pequeno (${content.length} bytes). Pode estar corrompido.`);
  }

  for (const pattern of BINARY_PATTERNS) {
    let i = 0;
    while (i <= result.length - pattern.prefix.length) {
      let found = true;
      for (let j = 0; j < pattern.prefix.length; j++) {
        if (result[i + j] !== pattern.prefix[j]) {
          found = false;
          break;
        }
      }

      if (found) {
        const valueStart = i + pattern.prefix.length;
        let valueEnd = valueStart;

        while (valueEnd < result.length && result[valueEnd] !== QUOTE_BYTE) {
          valueEnd++;
        }

        if (valueEnd < result.length) {
          for (let k = valueStart; k < valueEnd; k++) {
            result[k] = F_BYTE;
          }
          patternsFound++;
          i = valueEnd + 1;
          continue;
        }
        warnings.push(`Padrao ${pattern.name} encontrado na posicao ${i}, mas sem quote de fechamento.`);
      }
      i++;
    }
  }

  return { modified: result, patternsFound, warnings };
};

serve(async (req: Request): Promise<Response> => {
  const requestId = crypto.randomUUID();
  const logger = baseLogger.withContext({ requestId });
  const requestOrigin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(requestOrigin);

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return errorResponse("Method not allowed", 405, "METHOD_NOT_ALLOWED", corsHeaders, requestId);
    }

    // AUTENTICACAO COM RLS
    const authResult = await authenticateUser(req.headers.get("Authorization"));
    if (!authResult.success) {
      return errorResponse(authResult.error, authResult.status, "UNAUTHORIZED", corsHeaders, requestId);
    }

    const { user, supabase } = authResult;
    logger.info("User authenticated", { userId: user.id });

    // SECURITY: Consultar plano do usuario para aplicar limites corretos
    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscriptionError) {
      logger.error("Failed to fetch subscription", { message: subscriptionError.message });
      return errorResponse("Erro ao verificar assinatura.", 500, "SUBSCRIPTION_ERROR", corsHeaders, requestId);
    }

    const plan: SubscriptionPlan = (subscription?.plan as SubscriptionPlan) ?? "free";
    const maxFileSize = getMaxFileSizeForPlan(plan);
    logger.info("User plan limits", { userId: user.id, plan, maxFileSizeMB: maxFileSize / 1024 / 1024 });

    let upload: UploadedFile;
    try {
      upload = await extractUpload(req, maxFileSize);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const mapped = mapUploadError(message);
      return errorResponse(message, mapped.status, mapped.code, corsHeaders, requestId);
    }
    const fileName = upload.fileName;
    const originalSize = upload.fileBytes.length;

    if (originalSize === 0) {
      return errorResponse("Arquivo vazio.", 400, "EMPTY_FILE", corsHeaders, requestId);
    }

    if (!fileName.toLowerCase().endsWith(".xlsm")) {
      return errorResponse(
        "Tipo de arquivo invalido. Apenas .xlsm e permitido.",
        400,
        "INVALID_EXTENSION",
        corsHeaders,
        requestId,
      );
    }

    if (!hasZipMagicBytes(upload.fileBytes)) {
      return errorResponse(
        "Arquivo invalido. A assinatura nao corresponde a um Excel (.xlsm).",
        400,
        "INVALID_SIGNATURE",
        corsHeaders,
        requestId,
      );
    }

    let zip: JSZip;
    try {
      // SECURITY: Timeout para evitar travamento em arquivos malformados
      zip = await withTimeout(
        JSZip.loadAsync(upload.fileBytes),
        PROCESSING_TIMEOUT_MS,
        "ZIP load",
      );
    } catch (zipError) {
      const message = zipError instanceof Error ? zipError.message : String(zipError);
      logger.warn("Invalid ZIP file or timeout", { message });

      if (message.includes("timed out")) {
        return errorResponse(
          "Tempo limite excedido ao processar arquivo.",
          408,
          "PROCESSING_TIMEOUT",
          corsHeaders,
          requestId,
        );
      }

      return errorResponse(
        "Arquivo invalido ou corrompido. Verifique se e um arquivo Excel valido (.xlsm).",
        400,
        "INVALID_ZIP",
        corsHeaders,
        requestId,
      );
    }

    // SECURITY: Validar estrutura interna do XLSX
    if (!validateXlsxStructure(zip)) {
      return errorResponse(
        "Arquivo nao possui estrutura valida de Excel (.xlsm).",
        400,
        "INVALID_XLSX_STRUCTURE",
        corsHeaders,
        requestId,
      );
    }

    const vbaFile = zip.file(VBA_FILENAME);
    const vbaExists = vbaFile !== null;
    const warnings: string[] = [];

    if (!vbaExists) {
      const output = await zip.generateAsync({ type: "uint8array" });
      const response: ProcessFileResponse = {
        requestId,
        success: true,
        fileBase64: encodeBase64(toArrayBuffer(output)),
        originalFileName: fileName,
        newFileName: buildFileName(fileName),
        vbaExists: false,
        patternsModified: 0,
        shouldCountUsage: false,
        originalSize,
        modifiedSize: output.length,
        warnings: warnings.length > 0 ? warnings : undefined,
        mimeType: MIME_XLSM,
      };
      return jsonResponse(response, 200, corsHeaders);
    }

    const vbaContent = await vbaFile.async("uint8array");
    const { modified, patternsFound, warnings: vbaWarnings } = modifyVbaContent(vbaContent);
    if (vbaWarnings.length > 0) {
      warnings.push(...vbaWarnings);
    }

    if (patternsFound > 0) {
      zip.file(VBA_FILENAME, modified);
    }

    // SECURITY: Timeout para evitar travamento na compressao
    const output = await withTimeout(
      zip.generateAsync({
        type: "uint8array",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      }),
      PROCESSING_TIMEOUT_MS,
      "ZIP generate",
    );

    const response: ProcessFileResponse = {
      requestId,
      success: true,
      fileBase64: encodeBase64(toArrayBuffer(output)),
      originalFileName: fileName,
      newFileName: buildFileName(fileName),
      vbaExists: true,
      patternsModified: patternsFound,
      shouldCountUsage: patternsFound > 0,
      originalSize,
      modifiedSize: output.length,
      warnings: warnings.length > 0 ? warnings : undefined,
      mimeType: MIME_XLSM,
    };

    return jsonResponse(response, 200, corsHeaders);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Unexpected error", { message });
    return errorResponse("Erro ao processar arquivo.", 500, "PROCESSING_FAILED", corsHeaders, requestId);
  }
});
