-- Remove over-restrictive unique constraint on auth_attempts that blocked concurrent inserts
ALTER TABLE public.auth_attempts
  DROP CONSTRAINT IF EXISTS auth_attempts_ip_address_idx;
-- Ensure non-unique index remains for rate-limit lookups
CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip_time
  ON public.auth_attempts(ip_address, created_at DESC);
