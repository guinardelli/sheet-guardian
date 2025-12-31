import type Stripe from "https://esm.sh/stripe@18.5.0";
import { createWebhookHandler } from "./index.ts";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

type UpdateCall = {
  table: string;
  values: Record<string, unknown>;
  column: string;
  value: string;
};

const createHarness = () => {
  const updates: UpdateCall[] = [];
  const errorLogs: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  const processedEvents = new Set<string>();
  let nextEvent: Stripe.Event | null = null;

  const env = {
    get: (key: string) => {
      switch (key) {
        case "STRIPE_SECRET_KEY":
          return "sk_test";
        case "STRIPE_WEBHOOK_SECRET":
          return "whsec_test";
        case "SUPABASE_URL":
          return "https://example.supabase.co";
        case "SERVICE_ROLE_KEY":
          return "service_role_key";
        default:
          return undefined;
      }
    },
  };

  const logger = {
    info: (_message: string, _meta?: Record<string, unknown>) => {},
    warn: (_message: string, _meta?: Record<string, unknown>) => {},
    error: (message: string, meta?: Record<string, unknown>) => {
      errorLogs.push({ message, meta });
    },
  };

  const supabaseAdmin = {
    from: (table: string) => ({
      select: (_columns: string) => ({
        eq: (_column: string, _value: string) => ({
          maybeSingle: async () => {
            if (table === "subscriptions") {
              return { data: { user_id: "user_123", plan: "free" }, error: null };
            }
            if (table === "profiles") {
              return { data: { email: "test@example.com" }, error: null };
            }
            return { data: null, error: null };
          },
        }),
      }),
      update: (values: Record<string, unknown>) => ({
        eq: async (column: string, value: string) => {
          updates.push({ table, values, column, value });
          return { error: null };
        },
      }),
      insert: async (values: Record<string, unknown>) => {
        if (table !== "stripe_webhook_events") {
          return { error: null };
        }
        const eventId = String(values.event_id ?? "");
        if (processedEvents.has(eventId)) {
          return {
            error: {
              message: "duplicate key value violates unique constraint",
              code: "23505",
            },
          };
        }
        processedEvents.add(eventId);
        return { error: null };
      },
    }),
  };

  const stripe = {
    webhooks: {
      constructEvent: () => {
        if (!nextEvent) {
          throw new Error("Event not set");
        }
        return nextEvent;
      },
    },
    subscriptions: {
      retrieve: async () => ({
        id: "sub_123",
        status: "active",
        current_period_end: 1_730_000_000,
        cancel_at_period_end: false,
        customer: "cus_123",
        items: { data: [{ price: { product: "prod_TaJslOsZAWnhcN" } }] },
      } as Stripe.Subscription),
    },
    customers: {
      retrieve: async () => ({
        deleted: false,
        metadata: { user_id: "user_123" },
      } as Stripe.Customer),
    },
  };

  const handler = createWebhookHandler({
    env,
    logger,
    stripe,
    supabaseAdmin,
    now: () => new Date("2025-01-01T00:00:00.000Z"),
  });

  const setEvent = (event: Stripe.Event) => {
    nextEvent = event;
  };

  return { handler, updates, errorLogs, setEvent };
};

const makeRequest = () =>
  new Request("http://localhost", {
    method: "POST",
    headers: { "stripe-signature": "test" },
    body: JSON.stringify({}),
  });

const runCheckoutCompletedTest = async () => {
  const { handler, updates, setEvent } = createHarness();
  setEvent({
    id: "evt_checkout",
    type: "checkout.session.completed",
    data: {
      object: {
        customer: "cus_123",
        subscription: "sub_123",
        metadata: { user_id: "user_123" },
        payment_status: "unpaid",
      },
    },
  } as Stripe.Event);

  const response = await handler(makeRequest());
  assert(response.status === 200, "checkout.session.completed should return 200");
  assert(updates.length === 1, "checkout.session.completed should update subscription");
  assert(updates[0].values.plan === "professional", "plan should map to professional");
};

const runInvoiceFailedTest = async () => {
  const { handler, updates, errorLogs, setEvent } = createHarness();
  setEvent({
    id: "evt_invoice_failed",
    type: "invoice.payment_failed",
    data: {
      object: {
        customer: "cus_123",
        subscription: "sub_789",
      },
    },
  } as Stripe.Event);

  const response = await handler(makeRequest());
  assert(response.status === 200, "invoice.payment_failed should return 200");
  assert(updates.length === 1, "invoice.payment_failed should update subscription");
  assert(errorLogs.length === 1, "invoice.payment_failed should log error");
};

const runDuplicateEventTest = async () => {
  const { handler, updates, setEvent } = createHarness();
  const event = {
    id: "evt_duplicate",
    type: "checkout.session.completed",
    data: {
      object: {
        customer: "cus_123",
        subscription: "sub_123",
        metadata: { user_id: "user_123" },
        payment_status: "unpaid",
      },
    },
  } as Stripe.Event;

  setEvent(event);
  await handler(makeRequest());
  setEvent(event);
  await handler(makeRequest());

  assert(updates.length === 1, "duplicate event should not update twice");
};

if (import.meta.main) {
  await runCheckoutCompletedTest();
  await runInvoiceFailedTest();
  await runDuplicateEventTest();
  console.log("stripe-webhook.qa.ts: all checks passed");
}
