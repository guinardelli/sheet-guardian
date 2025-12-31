# Staging setup

## Objetivo
Padronizar a criacao do ambiente de staging para validar releases antes de producao.

## Passos
1. Criar um novo projeto no Supabase (staging).
2. Executar migrations no staging (Supabase CLI ou dashboard).
3. Configurar um projeto Vercel para staging (branch ou preview).
4. Definir as variaveis de ambiente usando `.env.staging.example` como base.
5. (Opcional) Configurar `PLAYWRIGHT_BASE_URL` apontando para o staging.

## Variaveis recomendadas
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY
- VITE_SUPABASE_PROJECT_ID
- STRIPE_SECRET_KEY (test)
- STRIPE_WEBHOOK_SECRET (test)
- VITE_SENTRY_DSN (staging)

## Validacoes
- Login e signup funcionam.
- Upload e processamento de arquivo funcionam.
- Checkout abre no Stripe em modo test.
- `health-check` retorna status 200.

## E2E
Para rodar E2E contra staging:

```bash
PLAYWRIGHT_BASE_URL=https://staging.seu-dominio.com \
E2E_EMAIL=usuario@exemplo.com \
E2E_PASSWORD=senha_segura \
npm run test:e2e
```
