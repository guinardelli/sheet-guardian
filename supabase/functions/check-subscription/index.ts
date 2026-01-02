import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createLogger } from "../_shared/logger.ts";
import { authenticateUser } from "../_shared/auth.ts";
import {
  getServiceRoleKey,
  getStripePremiumProductId,
  getStripeProfessionalProductId,
  getStripeSecretKey,
  getSupabaseUrl,
} from "../_shared/env.ts";
import type { SubscriptionPlan, SubscriptionResponse } from "../_shared/response-types.ts";

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

const baseLogger = createLogger("CHECK-SUBSCRIPTION");

const getProductToPlan = (): Record<string, SubscriptionPlan> => {
  const professionalProductId = getStripeProfessionalProductId();
  const premiumProductId = getStripePremiumProductId();

  return {
    [professionalProductId]: "professional",
    [premiumProductId]: "premium",
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

    // AUTENTICACAO COM RLS
    const authResult = await authenticateUser(req.headers.get("Authorization"));
    if (!authResult.success) {
      const body: SubscriptionResponse = {
        requestId,
        subscribed: false,
        error: authResult.error,
      };
      return new Response(JSON.stringify(body), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: authResult.status,
      });
    }

    const { user, supabase: supabaseUser } = authResult;
    logger.info("User authenticated", { userId: user.id, email: user.email });

    const { data: existingSubscription, error: existingError } = await supabaseUser
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      logger.warn("Failed to load existing subscription", { error: existingError.message, userId: user.id });
    }

    const stripeKey = getStripeSecretKey();
    const productToPlan = getProductToPlan();
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    logger.info("Looking up Stripe customer", { email: user.email });
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });

    if (customers.data.length === 0) {
      logger.info("No Stripe customer found, returning free plan");
      const body: SubscriptionResponse = {
        requestId,
        subscribed: false,
        plan: "free",
        product_id: null,
        subscription_end: null,
        cancel_at_period_end: false,
      };
      return new Response(JSON.stringify(body), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logger.info("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let plan: SubscriptionPlan = "free";
    let productId: string | null = null;
    let subscriptionEnd: string | null = null;
    let cancelAtPeriodEnd = false;

    // Service role para UPDATE - usuario ja autenticado via JWT
    // JUSTIFICATIVA: Sincronizacao com Stripe requer acesso privilegiado
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getServiceRoleKey();
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;
      productId = subscription.items.data[0].price.product as string;
      plan = productToPlan[productId] || "free";
      logger.info("Active subscription found", { subscriptionId: subscription.id, plan, productId });

      const shouldResetUsage = existingSubscription?.plan === "free" && plan !== "free";

      const { error: updateError } = await supabaseAdmin
        .from("subscriptions")
        .update({
          plan,
          payment_status: "active",
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          stripe_product_id: productId,
          cancel_at_period_end: cancelAtPeriodEnd,
          current_period_end: subscriptionEnd,
          ...(shouldResetUsage
            ? {
                sheets_used_today: 0,
                sheets_used_week: 0,
                last_sheet_date: null,
              }
            : {}),
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user.id);

      if (updateError) {
        logger.warn("Failed to update local subscription", { error: updateError.message });
      } else {
        logger.info("Subscription updated", {
          userId: user.id,
          plan,
          payment_status: "active",
          stripe_subscription_id: subscription.id,
        });
      }
    } else {
      logger.info("No active subscription found");

      const { error: resetError } = await supabaseAdmin
        .from("subscriptions")
        .update({
          plan: "free",
          payment_status: "pending",
          stripe_customer_id: customerId,
          stripe_subscription_id: null,
          stripe_product_id: null,
          cancel_at_period_end: false,
          current_period_end: null,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user.id);

      if (resetError) {
        logger.warn("Failed to reset subscription", { error: resetError.message, userId: user.id });
      } else {
        logger.info("Subscription reset to free", { userId: user.id });
      }
    }

    const body: SubscriptionResponse = {
      requestId,
      subscribed: hasActiveSub,
      plan,
      product_id: productId,
      subscription_end: subscriptionEnd,
      cancel_at_period_end: cancelAtPeriodEnd
    };
    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Error", { message: errorMessage });
    const body: SubscriptionResponse = {
      requestId,
      subscribed: false,
      error: errorMessage,
      details: "Erro ao verificar assinatura. Tente novamente em alguns segundos."
    };
    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
