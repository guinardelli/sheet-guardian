import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createLogger } from "../_shared/logger.ts";
import { getServiceRoleKey, getStripeSecretKey, getSupabaseUrl } from "../_shared/env.ts";
import type { CustomerPortalResponse } from "../_shared/response-types.ts";

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

const logger = createLogger("CUSTOMER-PORTAL");

serve(async (req: Request): Promise<Response> => {
  const requestOrigin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(requestOrigin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info("Function started");

    const stripeKey = getStripeSecretKey();
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getServiceRoleKey();

    const supabaseClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logger.info("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      throw new Error("No Stripe customer found for this user");
    }
    
    const customerId = customers.data[0].id;
    logger.info("Found Stripe customer", { customerId });

    const origin = requestOrigin && allowedOrigins.has(requestOrigin)
      ? requestOrigin
      : "https://vbablocker.vercel.app";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/plans`,
    });
    logger.info("Portal session created", { sessionId: portalSession.id });

    const body: CustomerPortalResponse = { url: portalSession.url };
    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Error", { message: errorMessage });
    const body: CustomerPortalResponse = { error: errorMessage };
    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
