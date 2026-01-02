import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createLogger } from "../_shared/logger.ts";
import { validateAdminToken } from "../_shared/auth.ts";
import { getAdminSecret, getServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";
import type { HealthCheckResponse, HealthCheckUser } from "../_shared/response-types.ts";

const allowedOrigins = new Set([
  "https://vbablocker.vercel.app",
  "http://localhost:8080",
]);

const getCorsHeaders = (origin: string | null) => {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
};

const baseLogger = createLogger("HEALTH-CHECK");

serve(async (req: Request): Promise<Response> => {
  const requestId = crypto.randomUUID();
  const logger = baseLogger.withContext({ requestId });
  const requestOrigin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(requestOrigin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // AUTENTICACAO VIA ADMIN SECRET
  let adminSecret: string;
  try {
    adminSecret = getAdminSecret();
  } catch {
    const body: HealthCheckResponse = {
      requestId,
      status: "error",
      error: "Admin secret not configured",
      timestamp: new Date().toISOString(),
    };
    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  const isAuthorized = validateAdminToken(req.headers.get("Authorization"), adminSecret);
  if (!isAuthorized) {
    logger.warn("Unauthorized health check attempt");
    const body: HealthCheckResponse = {
      requestId,
      status: "error",
      error: "Unauthorized",
      timestamp: new Date().toISOString(),
    };
    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;
  try {
    supabaseUrl = getSupabaseUrl();
    serviceRoleKey = getServiceRoleKey();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const body: HealthCheckResponse = {
      requestId,
      status: "error",
      error: message,
      timestamp: new Date().toISOString(),
    };
    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const allUsers: HealthCheckUser[] = [];
    const perPage = 1000;
    let page = 1;

    while (true) {
      const { data, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (usersError) {
        throw new Error(`Auth users query failed: ${usersError.message}`);
      }

      const usersPage = data?.users ?? [];
      allUsers.push(...usersPage.map((user) => ({ id: user.id, email: user.email })));

      if (!data?.nextPage || usersPage.length === 0) {
        break;
      }

      page = data.nextPage;
    }

    const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id");

    if (subscriptionsError) {
      throw new Error(`Subscriptions query failed: ${subscriptionsError.message}`);
    }

    const subscriptionIds = new Set((subscriptions ?? []).map((row) => row.user_id));
    const usersWithoutSubscription = allUsers.filter((user) => !subscriptionIds.has(user.id));

    const response: HealthCheckResponse = {
      requestId,
      status: usersWithoutSubscription.length === 0 ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      usersWithoutSubscription: usersWithoutSubscription.length,
      details: usersWithoutSubscription.length > 0 ? usersWithoutSubscription : undefined,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: response.status === "healthy" ? 200 : 500,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Health check error", { message });

    const response: HealthCheckResponse = {
      requestId,
      status: "error",
      error: message,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
