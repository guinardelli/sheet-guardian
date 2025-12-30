alter table subscriptions
  add column if not exists stripe_customer_id text unique;
alter table subscriptions
  add column if not exists stripe_subscription_id text unique;
alter table subscriptions
  add column if not exists stripe_product_id text;
create index if not exists idx_subscriptions_stripe_customer
  on subscriptions(stripe_customer_id);
