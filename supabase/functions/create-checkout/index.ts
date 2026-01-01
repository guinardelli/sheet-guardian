import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createLogger } from "../_shared/logger.ts";

const ANNUAL_PRICE_ID = Deno.env.get("STRIPE_ANNUAL_PRICE_ID")
  ?? Deno.env.get("VITE_STRIPE_ANNUAL_PRICE_ID")
  ?? "";

const ALLOWED_PRICE_TO_PRODUCT: Record<string, string> = {
  "price_1Sd9EhJkxX3Me4wlrU22rZwM": "prod_TaJslOsZAWnhcN", // professional
  "price_1Sd9F5JkxX3Me4wl1xNRb5Kh": "prod_TaJsysi99Q1g2J", // premium
  ...(ANNUAL_PRICE_ID ? { [ANNUAL_PRICE_ID]: "prod_TaJsysi99Q1g2J" } : {}),
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

const logger = createLogger("CREATE-CHECKOUT");

serve(async (req) => {
  const requestOrigin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(requestOrigin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")
    ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    ?? "";

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    logger.info("Function started");
    
    const { priceId } = await req.json();
    if (!priceId) throw new Error("Price ID is required");
    const allowedProduct = ALLOWED_PRICE_TO_PRODUCT[priceId];
    if (!allowedProduct) {
      throw new Error("Invalid priceId");
    }
    logger.info("Price ID received", { priceId });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      logger.warn("Auth getUser failed", { error: userError.message });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logger.info("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
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

    const price = await stripe.prices.retrieve(priceId);
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
          price: priceId,
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

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Error", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
