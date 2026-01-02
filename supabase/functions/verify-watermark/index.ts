import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { decode as decodeBase64 } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import JSZip from "https://esm.sh/jszip@3.10.1?target=deno";
import { createLogger } from "../_shared/logger.ts";
import { authenticateUser } from "../_shared/auth.ts";

const allowedOrigins = new Set([
  "https://vbablocker.vercel.app",
  "http://localhost:8080",
]);

const CORE_PROPS_FILE = "docProps/core.xml";
const ZIP_MAGIC_BYTES = [0x50, 0x4b, 0x03, 0x04];
const WATERMARK_REGEX = /SG:([0-9a-fA-F-]{36})/;
const ABSOLUTE_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const baseLogger = createLogger("VERIFY-WATERMARK");

type UploadPayload = {
  fileBase64?: string | null;
  fileName?: string | null;
};

type UploadedFile = {
  fileBytes: Uint8Array;
  fileName: string;
};

type WatermarkDelivery = {
  watermarkId: string;
  originalFileName: string;
  newFileName: string;
  createdAt: string;
};

type VerifyResponse =
  | {
      requestId: string;
      success: true;
      found: boolean;
      watermarkId?: string;
      delivery?: WatermarkDelivery | null;
      reason?: string;
    }
  | {
      requestId: string;
      success: false;
      error: string;
      errorCode?: string;
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
  const body: VerifyResponse = { requestId, success: false, error: message, errorCode };
  return jsonResponse(body, status, corsHeaders);
};

const decodeBase64Payload = (payload: string): Uint8Array => {
  const normalized = payload.includes(",")
    ? payload.slice(payload.indexOf(",") + 1)
    : payload;
  return decodeBase64(normalized);
};

const parseJsonPayload = (raw: unknown): UploadPayload => {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const record = raw as Record<string, unknown>;
  return {
    fileBase64: typeof record.fileBase64 === "string" ? record.fileBase64 : null,
    fileName: typeof record.fileName === "string" ? record.fileName : null,
  };
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

const extractUpload = async (req: Request): Promise<UploadedFile> => {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new Error("Missing file");
    }
    if (file.size > ABSOLUTE_MAX_FILE_SIZE_BYTES) {
      throw new Error("Arquivo muito grande");
    }
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const fileName = file.name || "arquivo.xlsm";
    return { fileBytes, fileName };
  }

  if (contentType.includes("application/json")) {
    const raw = await req.json() as unknown;
    const payload = parseJsonPayload(raw);
    if (!payload.fileBase64) {
      throw new Error("Missing fileBase64");
    }
    const fileBytes = decodeBase64Payload(payload.fileBase64);
    if (fileBytes.length > ABSOLUTE_MAX_FILE_SIZE_BYTES) {
      throw new Error("Arquivo muito grande");
    }
    const fileName = payload.fileName?.trim() || "arquivo.xlsm";
    return { fileBytes, fileName };
  }

  throw new Error("Unsupported content type");
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

    const authResult = await authenticateUser(req.headers.get("Authorization"));
    if (!authResult.success) {
      return errorResponse(authResult.error, authResult.status, "UNAUTHORIZED", corsHeaders, requestId);
    }

    const { user, supabase } = authResult;
    logger.info("User authenticated", { userId: user.id });

    let upload: UploadedFile;
    try {
      upload = await extractUpload(req);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorResponse(message, 400, "INVALID_UPLOAD", corsHeaders, requestId);
    }

    if (!upload.fileName.toLowerCase().endsWith(".xlsm")) {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn("Invalid ZIP file", { message });
      return errorResponse(
        "Arquivo invalido ou corrompido. Verifique se e um arquivo Excel valido (.xlsm).",
        400,
        "INVALID_ZIP",
        corsHeaders,
        requestId,
      );
    }

    const coreFile = zip.file(CORE_PROPS_FILE);
    if (!coreFile) {
      const body: VerifyResponse = {
        requestId,
        success: true,
        found: false,
        reason: "core.xml nao encontrado",
      };
      return jsonResponse(body, 200, corsHeaders);
    }

    let coreXml = "";
    try {
      coreXml = await coreFile.async("string");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorResponse(
        `Falha ao ler core.xml (${message})`,
        400,
        "CORE_XML_READ_FAILED",
        corsHeaders,
        requestId,
      );
    }

    const match = coreXml.match(WATERMARK_REGEX);
    if (!match) {
      const body: VerifyResponse = {
        requestId,
        success: true,
        found: false,
        reason: "watermark nao encontrado",
      };
      return jsonResponse(body, 200, corsHeaders);
    }

    const watermarkId = match[1];
    const { data, error } = await supabase
      .from("watermark_deliveries")
      .select("watermark_id, original_file_name, new_file_name, created_at")
      .eq("watermark_id", watermarkId)
      .maybeSingle();

    if (error) {
      logger.warn("Failed to lookup watermark delivery", { message: error.message, userId: user.id });
    }

    const delivery = data
      ? {
          watermarkId: data.watermark_id as string,
          originalFileName: data.original_file_name as string,
          newFileName: data.new_file_name as string,
          createdAt: data.created_at as string,
        }
      : null;

    const body: VerifyResponse = {
      requestId,
      success: true,
      found: true,
      watermarkId,
      delivery,
    };
    return jsonResponse(body, 200, corsHeaders);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Unexpected error", { message });
    return errorResponse("Internal server error", 500, "UNEXPECTED_ERROR", corsHeaders, requestId);
  }
});
