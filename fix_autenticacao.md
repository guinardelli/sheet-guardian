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
  -- Correção: Usar alias 'aa' explicitamente em todas as colunas para evitar ambiguidade
  SELECT COUNT(*) INTO attempt_count
  FROM public.auth_attempts AS aa
  WHERE aa.ip_address = user_ip
    AND aa.attempt_type = check_rate_limit.attempt_type -- Desambiguação explícita com o nome do parâmetro
    AND aa.created_at > NOW() - (window_minutes || ' minutes')::INTERVAL;

  RETURN attempt_count < max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;