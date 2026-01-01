import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createLogger } from "../_shared/logger.ts";
import { getServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";

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

const logger = createLogger("HEALTH-CHECK");

serve(async (req) => {
  const requestOrigin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(requestOrigin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;
  try {
    supabaseUrl = getSupabaseUrl();
    serviceRoleKey = getServiceRoleKey();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({
      status: "error",
      error: message,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const { data: users, error: usersError } = await supabaseAdmin
      .schema("auth")
      .from("users")
      .select("id, email");

    if (usersError) {
      throw new Error(`Auth users query failed: ${usersError.message}`);
    }

    const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id");

    if (subscriptionsError) {
      throw new Error(`Subscriptions query failed: ${subscriptionsError.message}`);
    }

    const subscriptionIds = new Set((subscriptions ?? []).map((row) => row.user_id));
    const usersWithoutSubscription = (users ?? []).filter((user) => !subscriptionIds.has(user.id));

    const response = {
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

    return new Response(JSON.stringify({
      status: "error",
      error: message,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
