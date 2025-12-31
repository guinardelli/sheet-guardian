import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createLogger } from "../_shared/logger.ts";

type SubscriptionPlan = "free" | "professional" | "premium";

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
  free: { sheetsPerWeek: null, sheetsPerMonth: 1, maxFileSizeMB: 1 },
  professional: { sheetsPerWeek: 5, sheetsPerMonth: null, maxFileSizeMB: 1 },
  premium: { sheetsPerWeek: null, sheetsPerMonth: null, maxFileSizeMB: null },
};

const TOKEN_TTL_MS = 5 * 60 * 1000;

const logger = createLogger("VALIDATE-PROCESSING");

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

serve(async (req) => {
  const requestOrigin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(requestOrigin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: ValidatePayload = {};
  try {
    payload = (await req.json()) as ValidatePayload;
  } catch (error) {
    logger.warn("Invalid JSON body", { message: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const action = payload.action ?? "validate";
  if (action !== "validate" && action !== "consume") {
    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")
    ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    ?? "";

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      logger.warn("Auth failure", { message: userError?.message });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.user;

    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("plan, sheets_used_today, sheets_used_week, sheets_used_month, last_sheet_date, last_reset_date")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscriptionError || !subscription) {
      logger.warn("Subscription not found", { userId: user.id, message: subscriptionError?.message });
      return new Response(JSON.stringify({ error: "Subscription not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    const failValidation = (reason: string) => {
      const body = action === "consume"
        ? { success: false, error: reason }
        : { allowed: false, reason, suggestUpgrade: true };

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    };

    if (limits.maxFileSizeMB && payload.file?.sizeBytes && payload.file.sizeBytes > limits.maxFileSizeMB * 1024 * 1024) {
      return failValidation(`Arquivo muito grande. Limite do plano: ${limits.maxFileSizeMB} MB.`);
    }

    if (limits.sheetsPerWeek !== null && usedThisWeek >= limits.sheetsPerWeek) {
      return failValidation(`Limite semanal atingido (${usedThisWeek}/${limits.sheetsPerWeek}).`);
    }

    if (limits.sheetsPerMonth !== null && usedThisMonth >= limits.sheetsPerMonth) {
      return failValidation(`Limite mensal atingido (${usedThisMonth}/${limits.sheetsPerMonth}).`);
    }

    if (action === "consume") {
      const processingToken = payload.processingToken;
      if (!processingToken) {
        return new Response(JSON.stringify({ success: false, error: "Missing processing token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: tokenRow, error: tokenError } = await supabase
        .from("processing_tokens")
        .select("id, expires_at, used_at")
        .eq("token", processingToken)
        .eq("user_id", user.id)
        .maybeSingle();

      if (tokenError || !tokenRow) {
        logger.warn("Processing token not found", { userId: user.id });
        return new Response(JSON.stringify({ success: false, error: "Invalid processing token" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (tokenRow.used_at) {
        return new Response(JSON.stringify({ success: false, error: "Processing token already used" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
        return new Response(JSON.stringify({ success: false, error: "Processing token expired" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: tokenUpdateError } = await supabase
        .from("processing_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", tokenRow.id);

      if (tokenUpdateError) {
        logger.error("Failed to mark processing token as used", { message: tokenUpdateError.message });
        return new Response(JSON.stringify({ success: false, error: "Token update failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
        return new Response(JSON.stringify({ success: false, error: "Failed to update usage" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Failed to create processing token" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      allowed: true,
      processingToken,
      expiresAt,
      plan,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("Unexpected error", { message: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
