# Uptime monitoring

## Objetivo
Monitorar endpoints criticos e avisar em caso de indisponibilidade.

## Endpoints sugeridos
- https://vbablocker.vercel.app/
- https://[PROJECT].supabase.co/functions/v1/health-check (header: `Authorization: Bearer $ADMIN_SECRET`)
- https://[PROJECT].supabase.co/auth/v1/health

## Configuracao recomendada
- Intervalo: 1 min
- Timeout: 10 s
- Retries: 2
- Status OK: 200-399
- Alertar apos 2 falhas consecutivas

## Canais de alerta
- Email
- Slack/SMS (opcional)

## Validacao
- Desligar temporariamente um endpoint de teste e confirmar alerta.
