create or replace function public.create_missing_subscription(p_user_id uuid)
returns void
security definer
set search_path = public
as $$
begin
  insert into subscriptions (
    user_id,
    plan,
    payment_status,
    sheets_used_today,
    sheets_used_week,
    sheets_used_month
  )
  values (p_user_id, 'free', 'active', 0, 0, 0)
  on conflict (user_id) do nothing;
end;
$$ language plpgsql;
