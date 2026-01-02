-- Harden subscriptions updates to block client-side tampering
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;

REVOKE UPDATE ON public.subscriptions FROM authenticated;
REVOKE UPDATE ON public.subscriptions FROM anon;

CREATE OR REPLACE FUNCTION public.increment_subscription_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.subscriptions
  SET
    sheets_used_today = CASE
      WHEN last_sheet_date = current_date THEN sheets_used_today + 1
      ELSE 1
    END,
    sheets_used_week = CASE
      WHEN last_sheet_date IS NOT NULL
        AND date_trunc('week', last_sheet_date) = date_trunc('week', current_date)
      THEN sheets_used_week + 1
      ELSE 1
    END,
    sheets_used_month = CASE
      WHEN last_reset_date IS NOT NULL
        AND date_trunc('month', last_reset_date) = date_trunc('month', current_date)
      THEN sheets_used_month + 1
      ELSE 1
    END,
    last_sheet_date = current_date,
    last_reset_date = CASE
      WHEN last_reset_date IS NOT NULL
        AND date_trunc('month', last_reset_date) = date_trunc('month', current_date)
      THEN last_reset_date
      ELSE current_date
    END
  WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_subscription_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_subscription_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_subscription_usage() TO service_role;
