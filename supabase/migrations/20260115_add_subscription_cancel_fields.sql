alter table subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;

alter table subscriptions
  add column if not exists current_period_end timestamptz;
