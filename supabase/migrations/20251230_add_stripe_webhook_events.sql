create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_webhook_events enable row level security;
comment on table public.stripe_webhook_events is
'Webhook event ids for Stripe idempotency tracking.';
