# Arquitetura do Sheet Guardian

## Visao geral
O Sheet Guardian e uma SPA React que processa arquivos .xlsm via Edge Functions para modificar padroes VBA. A autenticacao, persistencia e cobranca sao integradas com Supabase e Stripe. O deploy do frontend e feito em hosting estatico (Vercel).

## Fluxo principal
1. Usuario autentica via Supabase Auth.
2. Usuario faz upload de um arquivo .xlsm.
3. O frontend valida o arquivo (extensao, MIME e magic bytes).
4. O frontend solicita um processing token via Edge Function.
5. O frontend envia o arquivo e o token para a Edge Function `process-file`.
6. A Edge Function altera o vbaProject.bin, consome o token e atualiza os contadores.

## Frontend
- React 18 + Vite + TypeScript.
- Rotas protegidas para Dashboard e Account.
- Processamento do arquivo ocorre na Edge Function `process-file` (JSZip + manipulacao binaria).
- Estado de assinatura via hooks (useSubscription).

## Backend (Supabase)
- Auth: Supabase Auth (JWT).
- Database: Postgres com RLS.
- Edge Functions:
  - validate-processing: valida limites e emite token.
  - check-subscription: sincroniza status com Stripe.
  - create-checkout / customer-portal: fluxo de pagamento.
  - stripe-webhook: atualiza assinatura via eventos.
  - health-check: monitoramento (protegido por ADMIN_SECRET).
  - cleanup-tokens: remove tokens expirados (protegido por ADMIN_SECRET).

## Dados
- subscriptions: plano, contadores e referencias Stripe.
- profiles: informacoes do usuario.
- processing_tokens: tokens de uso temporarios.
- error_logs: erros client-side (quando habilitado).

## Integracoes externas
- Stripe: planos, checkout e webhooks.
- Sentry: captura de erros e traces (quando DSN configurado).
- Uptime monitoring: endpoints de health-check com header Authorization.

## Seguranca
- RLS no Supabase para isolar dados por usuario.
- CSP restritiva no frontend.
- Tokens de processamento com TTL curto e single-use.
- Validacao de arquivos por extensao/MIME/magic bytes.

## Observabilidade
- Logs locais no frontend em dev.
- Captura de erros em producao via Sentry (quando habilitado).
- Health-check para monitoramento externo.
