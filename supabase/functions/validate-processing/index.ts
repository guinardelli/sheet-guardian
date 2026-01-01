import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createLogger } from "../_shared/logger.ts";
import { getServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";
import type { ErrorResponse, SubscriptionPlan, TokenConsumeResponse, TokenResponse } from "../_shared/response-types.ts";

type ValidatePayload = {
  action?: "validate" | "consume";
  file?: {
    name?: string | null;
    sizeBytes?: number | null;
    mimeType?: string | null;
  };
  processingToken?: string | null;
};

const allowedOrigins = new Set([
  "https://vbablocker.vercel.app",
  "http://localhost:8080",
]);

const PLAN_LIMITS: Record<SubscriptionPlan, { sheetsPerWeek: number | null; sheetsPerMonth: number | null; maxFileSizeMB: number | null }> = {
  free: { sheetsPerWeek: null, sheetsPerMonth: 2, maxFileSizeMB: 1 },
  professional: { sheetsPerWeek: 5, sheetsPerMonth: null, maxFileSizeMB: 3 },
  premium: { sheetsPerWeek: null, sheetsPerMonth: null, maxFileSizeMB: null },
};

const TOKEN_TTL_MS = 5 * 60 * 1000;

const baseLogger = createLogger("VALIDATE-PROCESSING");

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

const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getWeekNumber = (date: Date): string => {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
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
  const body: ErrorResponse = { error: message, errorCode, requestId };
  return jsonResponse(body, status, corsHeaders);
};

serve(async (req: Request): Promise<Response> => {
  const requestId = crypto.randomUUID();
  const logger = baseLogger.withContext({ requestId });
  const requestOrigin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(requestOrigin);
  const withRequestId = <T extends Record<string, unknown>>(body: T): T & { requestId: string } => ({
    ...body,
    requestId,
  });

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return errorResponse("Method not allowed", 405, "METHOD_NOT_ALLOWED", corsHeaders, requestId);
    }

    let payload: ValidatePayload = {};
    try {
      payload = (await req.json()) as ValidatePayload;
    } catch (error) {
      logger.warn("Invalid JSON body", { message: error instanceof Error ? error.message : String(error) });
      return errorResponse("Invalid JSON body", 400, "INVALID_JSON", corsHeaders, requestId);
    }

    const action = payload.action ?? "validate";
    if (action !== "validate" && action !== "consume") {
      return errorResponse("Invalid action", 400, "INVALID_ACTION", corsHeaders, requestId);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Unauthorized", 401, "UNAUTHORIZED", corsHeaders, requestId);
    }

    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getServiceRoleKey();

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      logger.warn("Auth failure", { message: userError?.message });
      return errorResponse("Unauthorized", 401, "UNAUTHORIZED", corsHeaders, requestId);
    }

    const user = userData.user;

    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("plan, sheets_used_today, sheets_used_week, sheets_used_month, last_sheet_date, last_reset_date")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscriptionError || !subscription) {
      logger.warn("Subscription not found", { userId: user.id, message: subscriptionError?.message });
      return errorResponse("Subscription not found", 403, "SUBSCRIPTION_NOT_FOUND", corsHeaders, requestId);
    }

    const plan = (subscription.plan as SubscriptionPlan) ?? "free";
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

    const today = new Date();
    const todayStr = getLocalDateString(today);
    const currentWeek = getWeekNumber(today);
    const currentMonth = todayStr.substring(0, 7);

    const lastDate = subscription.last_sheet_date
      ? new Date(`${subscription.last_sheet_date}T00:00:00`)
      : null;
    const lastWeek = lastDate ? getWeekNumber(lastDate) : "";
    const lastResetMonth = subscription.last_reset_date
      ? subscription.last_reset_date.substring(0, 7)
      : null;

    const usedThisWeek = lastWeek === currentWeek ? (subscription.sheets_used_week ?? 0) : 0;
    const usedThisMonth = lastResetMonth === currentMonth ? (subscription.sheets_used_month ?? 0) : 0;

    const failValidation = (reason: string, errorCode: string) => {
      if (action === "consume") {
        const body: TokenConsumeResponse = withRequestId({ success: false, error: reason, errorCode });
        return jsonResponse(body, 400, corsHeaders);
      }

      const body: TokenResponse = withRequestId({ allowed: false, reason, suggestUpgrade: true, errorCode });
      return jsonResponse(body, 400, corsHeaders);
    };

    if (limits.maxFileSizeMB && payload.file?.sizeBytes && payload.file.sizeBytes > limits.maxFileSizeMB * 1024 * 1024) {
      return failValidation(`Arquivo muito grande. Limite do plano: ${limits.maxFileSizeMB} MB.`, "FILE_TOO_LARGE");
    }

    if (limits.sheetsPerWeek !== null && usedThisWeek >= limits.sheetsPerWeek) {
      return failValidation(`Limite semanal atingido (${usedThisWeek}/${limits.sheetsPerWeek}).`, "WEEKLY_LIMIT_REACHED");
    }

    if (limits.sheetsPerMonth !== null && usedThisMonth >= limits.sheetsPerMonth) {
      return failValidation(`Limite mensal atingido (${usedThisMonth}/${limits.sheetsPerMonth}).`, "MONTHLY_LIMIT_REACHED");
    }

    if (action === "consume") {
      const processingToken = payload.processingToken;
      if (!processingToken) {
        const body: TokenConsumeResponse = withRequestId({
          success: false,
          error: "Missing processing token",
          errorCode: "MISSING_PROCESSING_TOKEN",
        });
        return jsonResponse(body, 400, corsHeaders);
      }

      const { data: tokenRow, error: tokenError } = await supabase
        .from("processing_tokens")
        .select("id, expires_at, used_at")
        .eq("token", processingToken)
        .eq("user_id", user.id)
        .maybeSingle();

      if (tokenError || !tokenRow) {
        logger.warn("Processing token not found", { userId: user.id });
        return errorResponse("Invalid processing token", 403, "INVALID_PROCESSING_TOKEN", corsHeaders, requestId);
      }

      if (tokenRow.used_at) {
        return errorResponse("Processing token already used", 403, "PROCESSING_TOKEN_USED", corsHeaders, requestId);
      }

      if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
        return errorResponse("Processing token expired", 403, "PROCESSING_TOKEN_EXPIRED", corsHeaders, requestId);
      }

      const { error: tokenUpdateError } = await supabase
        .from("processing_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", tokenRow.id);

      if (tokenUpdateError) {
        logger.error("Failed to mark processing token as used", { message: tokenUpdateError.message });
        return errorResponse("Failed to update processing token", 500, "TOKEN_UPDATE_FAILED", corsHeaders, requestId);
      }

      const isToday = subscription.last_sheet_date === todayStr;
      const newSheetsToday = isToday ? subscription.sheets_used_today + 1 : 1;
      const newSheetsWeek = lastWeek === currentWeek ? (subscription.sheets_used_week ?? 0) + 1 : 1;
      const newSheetsMonth = lastResetMonth === currentMonth
        ? subscription.sheets_used_month + 1
        : 1;

      const { error: usageError } = await supabase
        .from("subscriptions")
        .update({
          sheets_used_today: newSheetsToday,
          sheets_used_week: newSheetsWeek,
          sheets_used_month: newSheetsMonth,
          last_sheet_date: todayStr,
          last_reset_date: lastResetMonth === currentMonth ? subscription.last_reset_date : todayStr,
        })
        .eq("user_id", user.id);

      if (usageError) {
        logger.error("Failed to update usage", { message: usageError.message, userId: user.id });
        return errorResponse("Failed to update usage", 500, "USAGE_UPDATE_FAILED", corsHeaders, requestId);
      }

      const body: TokenConsumeResponse = withRequestId({ success: true });
      return jsonResponse(body, 200, corsHeaders);
    }

    const processingToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

    const { error: tokenInsertError } = await supabase
      .from("processing_tokens")
      .insert({
        user_id: user.id,
        token: processingToken,
        expires_at: expiresAt,
      });

    if (tokenInsertError) {
      logger.error("Failed to create processing token", { message: tokenInsertError.message, userId: user.id });
      return errorResponse("Failed to create processing token", 500, "TOKEN_CREATE_FAILED", corsHeaders, requestId);
    }

    const body: TokenResponse = withRequestId({
      allowed: true,
      processingToken,
      expiresAt,
      plan,
    });
    return jsonResponse(body, 200, corsHeaders);
  } catch (error) {
    logger.error("Unexpected error", { message: error instanceof Error ? error.message : String(error) });
    return errorResponse("Internal server error", 500, "UNEXPECTED_ERROR", corsHeaders, requestId);
  }
});
