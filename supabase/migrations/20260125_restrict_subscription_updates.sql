-- Restrict sensitive subscription fields from client-side updates
REVOKE UPDATE (
  plan,
  payment_status,
  stripe_customer_id,
  stripe_product_id,
  stripe_subscription_id,
  cancel_at_period_end,
  current_period_end
) ON public.subscriptions FROM authenticated;

-- Allow usage counters to be updated by authenticated (RLS still applies)
GRANT UPDATE (
  sheets_used_today,
  sheets_used_week,
  sheets_used_month,
  last_sheet_date,
  last_reset_date,
  updated_at
) ON public.subscriptions TO authenticated;
