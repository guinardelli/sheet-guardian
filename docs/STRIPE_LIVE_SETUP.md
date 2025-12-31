# Stripe live mode setup

## Objetivo
Migrar para live mode com produtos, precos e webhook ativos.

## Checklist rapido
1. Criar produtos e precos no Stripe (live mode).
2. Atualizar IDs em `src/lib/stripe.ts`.
3. Atualizar variaveis no ambiente (Vercel/Supabase).
4. Configurar webhook para `stripe-webhook`.
5. Testar checkout em live mode.

## Passos detalhados

### 1) Produtos e precos (live mode)
- Criar produto Professional e Premium.
- Anotar `product_id` e `price_id`.

### 2) Atualizar IDs no codigo
Editar `src/lib/stripe.ts`:
```ts
export const STRIPE_PLANS = {
  professional: {
    product_id: 'prod_LIVE_ID',
    price_id: 'price_LIVE_ID',
  },
  premium: {
    product_id: 'prod_LIVE_ID',
    price_id: 'price_LIVE_ID',
  },
} as const;
```

### 3) Variaveis de ambiente
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
