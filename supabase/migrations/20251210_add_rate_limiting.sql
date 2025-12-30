-- Add rate limiting infrastructure for authentication attempts
-- This helps prevent brute force attacks and abuse

-- Create table to track authentication attempts
CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  email TEXT,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('login', 'signup', 'password_reset')),
  success BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_agent TEXT,
  -- Index for fast lookups
  CONSTRAINT auth_attempts_ip_address_idx UNIQUE (ip_address, created_at)
);
-- Create index on ip_address and created_at for rate limit checks
CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip_time
ON public.auth_attempts(ip_address, created_at DESC);
-- Create index on email and created_at for per-user rate limiting
CREATE INDEX IF NOT EXISTS idx_auth_attempts_email_time
ON public.auth_attempts(email, created_at DESC);
-- Function to check if IP is rate limited
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  user_ip TEXT,
  attempt_type TEXT,
  max_attempts INTEGER DEFAULT 5,
  window_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN AS $$
DECLARE
  attempt_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM public.auth_attempts
  WHERE ip_address = user_ip
    AND attempt_type = check_rate_limit.attempt_type
    AND created_at > NOW() - (window_minutes || ' minutes')::INTERVAL;

  RETURN attempt_count < max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Function to log authentication attempt
CREATE OR REPLACE FUNCTION public.log_auth_attempt(
  user_ip TEXT,
  user_email TEXT DEFAULT NULL,
  attempt_type TEXT DEFAULT 'login',
  was_successful BOOLEAN DEFAULT FALSE,
  user_agent_string TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.auth_attempts (
    ip_address,
    email,
    attempt_type,
    success,
    user_agent,
    created_at
  ) VALUES (
    user_ip,
    user_email,
    attempt_type,
    was_successful,
    user_agent_string,
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Function to clean up old auth attempts (keep last 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_auth_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM public.auth_attempts
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Create a cron job to clean up old attempts daily (requires pg_cron extension)
-- Note: This requires pg_cron extension which may need to be enabled in Supabase
-- You can also run this manually or via a scheduled edge function
COMMENT ON FUNCTION public.cleanup_old_auth_attempts() IS
'Run this function daily to clean up auth attempts older than 30 days. Can be triggered via Supabase Edge Function cron job.';
-- Grant necessary permissions
GRANT SELECT, INSERT ON public.auth_attempts TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_auth_attempt TO anon, authenticated;
-- Add comment for documentation
COMMENT ON TABLE public.auth_attempts IS
'Tracks authentication attempts for rate limiting and security monitoring. Helps prevent brute force attacks.';
