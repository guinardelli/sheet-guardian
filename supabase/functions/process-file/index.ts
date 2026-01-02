import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { encode as encodeBase64, decode as decodeBase64 } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import JSZip from "https://esm.sh/jszip@3.10.1?target=deno";
import { createLogger } from "../_shared/logger.ts";
import { authenticateUser } from "../_shared/auth.ts";
import type { ProcessFileResponse } from "../_shared/response-types.ts";

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

const extractUpload = async (req: Request): Promise<UploadedFile> => {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new Error("Missing file");
    }
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const fileName = file.name || "arquivo.xlsm";
    const mimeType = file.type || MIME_XLSM;
    return { fileBytes, fileName, mimeType };
  }

  if (contentType.includes("application/json")) {
    const raw = await req.json() as unknown;
    const payload = parseJsonPayload(raw);
    if (!payload.fileBase64) {
      throw new Error("Missing fileBase64");
    }
    const fileBytes = decodeBase64Payload(payload.fileBase64);
    const fileName = payload.fileName?.trim() || "arquivo.xlsm";
    const mimeType = payload.mimeType?.trim() || MIME_XLSM;
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

    const { user } = authResult;
    logger.info("User authenticated", { userId: user.id });

    let upload: UploadedFile;
    try {
      upload = await extractUpload(req);
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
      zip = await JSZip.loadAsync(upload.fileBytes);
    } catch (zipError) {
      logger.warn("Invalid ZIP file", { message: zipError instanceof Error ? zipError.message : String(zipError) });
      return errorResponse(
        "Arquivo invalido ou corrompido. Verifique se e um arquivo Excel valido (.xlsm).",
        400,
        "INVALID_ZIP",
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

    const output = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

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
