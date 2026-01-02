import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createLogger } from "../_shared/logger.ts";
import { authenticateUser } from "../_shared/auth.ts";
import {
  getServiceRoleKey,
  getStripeAnnualPriceId,
  getStripePremiumPriceId,
  getStripePremiumProductId,
  getStripeProfessionalPriceId,
  getStripeProfessionalProductId,
  getStripeSecretKey,
  getSupabaseUrl,
} from "../_shared/env.ts";
import type { CheckoutResponse } from "../_shared/response-types.ts";

const buildAllowedPriceMap = () => {
  const professionalPriceId = getStripeProfessionalPriceId();
  const premiumPriceId = getStripePremiumPriceId();
  const annualPriceId = getStripeAnnualPriceId();
  const professionalProductId = getStripeProfessionalProductId();
  const premiumProductId = getStripePremiumProductId();

  return {
    [professionalPriceId]: professionalProductId,
    [premiumPriceId]: premiumProductId,
    [annualPriceId]: premiumProductId,
  };
};

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

const baseLogger = createLogger("CREATE-CHECKOUT");

type CreateCheckoutPayload = {
  priceId?: string | null;
};

const parseCheckoutPayload = async (req: Request): Promise<CreateCheckoutPayload> => {
  const raw = await req.json() as unknown;
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const payload = raw as { priceId?: unknown };
  return {
    priceId: typeof payload.priceId === "string" ? payload.priceId : null,
  };
};

serve(async (req: Request): Promise<Response> => {
  const requestId = crypto.randomUUID();
  const logger = baseLogger.withContext({ requestId });
  const requestOrigin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(requestOrigin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info("Function started");

    const stripeSecretKey = getStripeSecretKey();
    const allowedPriceToProduct = buildAllowedPriceMap();
    
    const payload = await parseCheckoutPayload(req);
    const normalizedPriceId = (payload.priceId ?? "").trim();
    if (!normalizedPriceId) throw new Error("Price ID is required");
    const allowedProduct = allowedPriceToProduct[normalizedPriceId];
    if (!allowedProduct) {
      throw new Error("Invalid priceId");
    }
    logger.info("Price ID received", { priceId: normalizedPriceId });

    // AUTENTICACAO COM RLS
    const authResult = await authenticateUser(req.headers.get("Authorization"));
    if (!authResult.success) {
      const body: CheckoutResponse = { error: authResult.error, requestId };
      return new Response(JSON.stringify(body), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: authResult.status,
      });
    }

    const { user } = authResult;
    if (!user.email) throw new Error("User email not available");
    logger.info("User authenticated", { userId: user.id, email: user.email });

    // Service role para UPDATE - usuario ja autenticado via JWT
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getServiceRoleKey();
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logger.info("Existing customer found", { customerId });
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      logger.info("New customer created", { customerId });
    }

    const price = await stripe.prices.retrieve(normalizedPriceId);
    const productId = typeof price.product === "string" ? price.product : price.product.id;
    if (productId !== allowedProduct) {
      throw new Error("Price/product mismatch");
    }

    const { error: updateError } = await supabaseAdmin
      .from("subscriptions")
      .update({
        stripe_customer_id: customerId,
        stripe_product_id: productId,
      })
      .eq("user_id", user.id);

    if (updateError) {
      logger.warn("Failed to update Stripe IDs", { error: updateError.message });
    }

    const origin = requestOrigin && allowedOrigins.has(requestOrigin)
      ? requestOrigin
      : "https://vbablocker.vercel.app";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: normalizedPriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/plans?success=true`,
      cancel_url: `${origin}/plans?canceled=true`,
      metadata: {
        user_id: user.id,
      },
    });

    logger.info("Checkout session created", { sessionId: session.id, url: session.url });

    const body: CheckoutResponse = { url: session.url, requestId };
    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Error", { message: errorMessage });
    const body: CheckoutResponse = { error: errorMessage, requestId };
    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
