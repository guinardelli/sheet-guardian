# Sentry alerts and DSN setup

## Objetivo
Configurar DSN e regras de alerta para o frontend.

## Passos
1) Criar projeto (React) no Sentry.
2) Copiar o DSN do projeto.
3) Definir `VITE_SENTRY_DSN` no ambiente (Vercel e staging).
4) Validar evento com erro controlado.

## Regras sugeridas
- Error rate > 5% em 5 min (critical)
- New issue (warning)
- P95 latency > 5s em 5 min (warning)
- Spike de JS errors (warning)

## Notificacoes
- Email
- Slack (opcional, via integration)

## Validacao
- Abrir o app em producao e acionar um erro controlado.
- Confirmar o evento no dashboard do Sentry.
