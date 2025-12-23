-- Create table for client-side error logging
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  stack TEXT,
  url TEXT,
  user_agent TEXT,
  context JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anon/authenticated clients
CREATE POLICY "Allow insert error logs"
ON public.error_logs FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Helpful indexes for monitoring
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at
ON public.error_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_user_id
ON public.error_logs(user_id);

COMMENT ON TABLE public.error_logs IS
'Client-side error logs for monitoring and troubleshooting.';
