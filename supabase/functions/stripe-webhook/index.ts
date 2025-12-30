import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createLogger } from "../_shared/logger.ts";

type PlanName = "free" | "professional" | "premium";

const PRODUCT_TO_PLAN: Record<string, PlanName> = {
  "prod_TaJslOsZAWnhcN": "professional",
  "prod_TaJsysi99Q1g2J": "premium",
};

const logger = createLogger("STRIPE-WEBHOOK");

const getPlanForProduct = (productId: string | null | undefined): PlanName =>
  productId && PRODUCT_TO_PLAN[productId] ? PRODUCT_TO_PLAN[productId] : "free";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")
    ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    ?? "";

  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    logger.error("Missing required env vars");
    return new Response("Server misconfigured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing Stripe signature", { status: 400 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Invalid signature", { message });
    return new Response("Invalid signature", { status: 400 });
  }

  logger.info("Webhook received", { eventType: event.type, eventId: event.id });

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const resolveUserId = async (customerId: string, fallbackUserId?: string) => {
    if (fallbackUserId) {
      return fallbackUserId;
    }

    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    if (data?.user_id) {
      return data.user_id;
    }

    try {
      const customer = await stripe.customers.retrieve(customerId);
      if ("deleted" in customer && customer.deleted) {
        return null;
      }

      const metadataUserId = customer.metadata?.user_id;
      return metadataUserId || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn("Failed to resolve user from customer", { message, customerId });
      return null;
    }
  };

  const updateSubscription = async (
    userId: string | null,
    customerId: string | null,
    updates: Record<string, unknown>
  ) => {
    if (userId) {
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update(updates)
        .eq("user_id", userId);

      if (error) {
        logger.warn("Failed to update subscription by user", { error: error.message, userId });
      } else {
        const updateSummary = {
          plan: (updates as { plan?: string }).plan,
          payment_status: (updates as { payment_status?: string }).payment_status,
          stripe_subscription_id: (updates as { stripe_subscription_id?: string | null })
            .stripe_subscription_id,
        };
        logger.info("Subscription updated", { userId, ...updateSummary });
      }
      return;
    }

    if (customerId) {
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update(updates)
        .eq("stripe_customer_id", customerId);

      if (error) {
        logger.warn("Failed to update subscription by customer", { error: error.message, customerId });
      } else {
        const updateSummary = {
          plan: (updates as { plan?: string }).plan,
          payment_status: (updates as { payment_status?: string }).payment_status,
          stripe_subscription_id: (updates as { stripe_subscription_id?: string | null })
            .stripe_subscription_id,
        };
        logger.info("Subscription updated", { customerId, ...updateSummary });
      }
      return;
    }

    logger.warn("No user/customer mapping found", { eventType: event.type });
  };

  const sendUpgradeEmail = async (userId: string | null, plan: PlanName) => {
    if (!userId || plan === "free") {
      return;
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("RESEND_FROM_EMAIL");

    if (!resendApiKey || !resendFrom) {
      logger.warn("Email provider not configured, skipping upgrade email", { userId });
      return;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      logger.warn("Failed to fetch profile email", { error: profileError.message, userId });
      return;
    }

    if (!profile?.email) {
      logger.warn("No email found for user", { userId });
      return;
    }

    const emailHtml = `
      <h2>Upgrade Confirmado!</h2>
      <p>Parabens! Seu plano foi atualizado para <strong>${plan}</strong>.</p>
      <p>Voce agora tem acesso a todos os beneficios do plano ${plan}.</p>
      <p>Obrigado por escolher Sheet Guardian!</p>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom,
        to: profile.email,
        subject: "Upgrade confirmado - Sheet Guardian",
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      logger.warn("Failed to send upgrade email", {
        status: response.status,
        body: bodyText.slice(0, 200),
      });
      return;
    }

    logger.info("Upgrade email sent", { email: profile.email, plan, userId });
  };

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string | null;
        const subscriptionId = session.subscription as string | null;
        const userId = session.metadata?.user_id ?? null;

        if (!customerId || !subscriptionId) {
          logger.warn("Missing customer or subscription on checkout session", {
            customerId,
            subscriptionId,
          });
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const productId = subscription.items.data[0]?.price?.product as string | undefined;
        const plan = getPlanForProduct(productId);

        const resolvedUserId = await resolveUserId(customerId, userId ?? undefined);

        await updateSubscription(resolvedUserId, customerId, {
          plan,
          payment_status: "active",
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_product_id: productId ?? null,
          updated_at: new Date().toISOString(),
        });

        if (session.payment_status === "paid") {
          await sendUpgradeEmail(resolvedUserId, plan);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const productId = subscription.items.data[0]?.price?.product as string | undefined;
        const plan = getPlanForProduct(productId);
        const status = subscription.status;
        const paymentStatus = status === "active" || status === "trialing"
          ? "active"
          : status === "past_due" || status === "unpaid"
          ? "payment_failed"
          : "pending";

        const userId = await resolveUserId(customerId);

        await updateSubscription(userId, customerId, {
          plan,
          payment_status: paymentStatus,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          stripe_product_id: productId ?? null,
          updated_at: new Date().toISOString(),
        });
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const userId = await resolveUserId(customerId);

        await updateSubscription(userId, customerId, {
          plan: "free",
          payment_status: "pending",
          stripe_subscription_id: null,
          stripe_product_id: null,
          updated_at: new Date().toISOString(),
        });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string | null;
        const subscriptionId = invoice.subscription as string | null;
        const userId = customerId ? await resolveUserId(customerId) : null;

        await updateSubscription(userId, customerId, {
          payment_status: "payment_failed",
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          updated_at: new Date().toISOString(),
        });
        break;
      }
      default:
        logger.info("Unhandled event type", { eventType: event.type });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Handler error", { message, eventType: event.type });
    return new Response("Webhook handler failed", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
