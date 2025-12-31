# Stripe live mode setup

## Objetivo
Migrar para live mode com produtos, precos e webhook ativos.

## Checklist rapido
1. Criar produtos e precos no Stripe (live mode).
2. Atualizar IDs publicos via env (`VITE_STRIPE_*`).
3. Atualizar secrets no ambiente (Vercel/Supabase).
4. Configurar webhook para `stripe-webhook`.
5. Testar checkout em live mode.

## Passos detalhados

### 1) Produtos e precos (live mode)
- Criar produto Professional e Premium.
- Anotar `product_id` e `price_id`.

### 2) Atualizar IDs publicos via env
Atualizar no ambiente de producao:
```
VITE_STRIPE_PROFESSIONAL_PRODUCT_ID=prod_live_professional
VITE_STRIPE_PROFESSIONAL_PRICE_ID=price_live_professional
VITE_STRIPE_PREMIUM_PRODUCT_ID=prod_live_premium
VITE_STRIPE_PREMIUM_PRICE_ID=price_live_premium
```

### 3) Variaveis de ambiente (secrets)
Atualizar no ambiente de producao:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 4) Webhook Stripe -> Supabase
Endpoint esperado:
```
https://[PROJECT_ID].supabase.co/functions/v1/stripe-webhook
```
Eventos recomendados:
- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- invoice.paid
- invoice.payment_failed

### 5) Teste em producao
- Criar checkout real com cartao valido.
- Confirmar atualizacao de assinatura no app.
- Verificar logs da edge function.

## Observacoes
- Guarde os IDs e segredos em cofre seguro.
- Nao comitar `.env`.
