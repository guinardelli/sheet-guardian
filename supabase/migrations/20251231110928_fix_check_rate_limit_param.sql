-- Fix ambiguous parameter reference in check_rate_limit
DROP FUNCTION IF EXISTS public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  user_ip TEXT,
  p_attempt_type TEXT,
  max_attempts INTEGER DEFAULT 5,
  window_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN AS $$
DECLARE
  attempt_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM public.auth_attempts AS aa
  WHERE aa.ip_address = user_ip
    AND aa.attempt_type = p_attempt_type
    AND aa.created_at > NOW() - (window_minutes || ' minutes')::INTERVAL;

  RETURN attempt_count < max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
