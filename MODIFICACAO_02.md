# MODIFICACAO_02: Correção das Edge Functions Stripe

## Diagnóstico Completo

### Problema Principal: Assinatura existe no Stripe mas não sincroniza com o banco

**Evidências do Stripe MCP:**
- Cliente `cus_Tex9IQFQjenXJI` tem **5 assinaturas ativas**
- Subscription ID mais recente: `sub_1Sk352JkxX3Me4wlmi1Wx8Rf`
- Status: **active**
- Product: `prod_TaJslOsZAWnhcN` (Professional)

**Evidências do Banco de Dados:**
```
plan: "free"                    ← NÃO foi atualizado
stripe_subscription_id: null    ← NÃO foi preenchido
```

---

## Erros Identificados nos Logs

### 1. `check-subscription` → HTTP 500 (Internal Server Error)
```
POST | 500 | check-subscription (múltiplas chamadas)
```

### 2. `stripe-webhook` → HTTP 401 (Unauthorized)
```
POST | 401 | stripe-webhook (TODAS as chamadas)
```

---

## Causas Raiz

### Causa 1: Webhook Bloqueado por JWT Verification

O Supabase Edge Functions **por padrão** requer autenticação JWT. O Stripe envia webhooks sem JWT, resultando em 401.

**Solução:** Desabilitar JWT verification para o webhook.

### Causa 2: Possível API Version Inválida

A versão `"2025-08-27.basil"` é uma versão futura/beta que pode causar problemas.

**Localização do problema:**
- `check-subscription/index.ts:66`
- `stripe-webhook/index.ts:40`
- `create-checkout/index.ts:82`

### Causa 3: Possível Falta de SERVICE_ROLE_KEY

O `check-subscription` usa `SERVICE_ROLE_KEY` para atualizar o banco. Se estiver ausente, a função falha.

---

## Correções Necessárias

### Correção 1: Desabilitar JWT Verification no Webhook

**Opção A: Via Supabase Dashboard**
1. Acesse: https://supabase.com/dashboard/project/dgweztejbixowxmfizgx/functions
2. Clique na função `stripe-webhook`
3. Em "Settings" → desabilite "Enforce JWT Verification"

**Opção B: Via Supabase CLI**
```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

### Correção 2: Atualizar API Version do Stripe

**Arquivo:** `supabase/functions/check-subscription/index.ts`
**Linha 66:** Alterar de:
```typescript
const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
```
Para:
```typescript
const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });
```

**Arquivo:** `supabase/functions/stripe-webhook/index.ts`
**Linha 40:** Mesma alteração

**Arquivo:** `supabase/functions/create-checkout/index.ts`
**Linha 82:** Mesma alteração

### Correção 3: Verificar Secrets do Supabase

Execute no Supabase Dashboard ou CLI para verificar se as secrets estão configuradas:

**Secrets Obrigatórias:**
```
STRIPE_SECRET_KEY=sk_test_... ou sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SERVICE_ROLE_KEY=eyJ... (ou SUPABASE_SERVICE_ROLE_KEY)
```

**Como verificar via Dashboard:**
1. Acesse: https://supabase.com/dashboard/project/dgweztejbixowxmfizgx/settings/vault
2. Ou: Project Settings → Edge Functions → Secrets

**Como configurar via CLI:**
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase secrets set SERVICE_ROLE_KEY=eyJxxx
```

### Correção 4: Redeployar as Edge Functions

Após as correções, redeployar:

```bash
# Deploy do webhook SEM verificação JWT
supabase functions deploy stripe-webhook --no-verify-jwt

# Deploy das outras funções
supabase functions deploy check-subscription
supabase functions deploy create-checkout
```

---

## Verificação Pós-Correção

### Teste 1: Verificar Webhook
```bash
# No Stripe Dashboard, reenvie um evento de webhook
# Ou use o Stripe CLI:
stripe trigger checkout.session.completed
```

### Teste 2: Verificar check-subscription
```bash
# Faça login na aplicação e clique em "Verificar Assinatura"
# Deve retornar sucesso e atualizar o plano
```

### Teste 3: Verificar Banco de Dados
```sql
SELECT
  plan,
  payment_status,
  stripe_subscription_id
FROM subscriptions
WHERE stripe_customer_id = 'cus_Tex9IQFQjenXJI';
```

**Resultado esperado:**
```
plan: "professional"
payment_status: "active"
stripe_subscription_id: "sub_1Sk352JkxX3Me4wlmi1Wx8Rf"
```

---

## Correção Temporária: Atualizar Manualmente o Banco

Se precisar ativar a assinatura imediatamente enquanto corrige os problemas:

```sql
UPDATE subscriptions
SET
  plan = 'professional',
  payment_status = 'active',
  stripe_subscription_id = 'sub_1Sk352JkxX3Me4wlmi1Wx8Rf',
  updated_at = NOW()
WHERE stripe_customer_id = 'cus_Tex9IQFQjenXJI';
```

⚠️ **IMPORTANTE:** Isso é uma correção temporária. As correções nas Edge Functions são necessárias para que futuras assinaturas funcionem corretamente.

---

## Resumo de Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/check-subscription/index.ts` | Linha 66: API version |
| `supabase/functions/stripe-webhook/index.ts` | Linha 40: API version |
| `supabase/functions/create-checkout/index.ts` | Linha 82: API version |
| Supabase Dashboard/CLI | Desabilitar JWT no webhook |
| Supabase Secrets | Verificar STRIPE_WEBHOOK_SECRET |

---

## Instruções Completas via CLI

### Passo 1: Verificar Supabase CLI
```bash
supabase --version
```

Se não estiver instalado:
```bash
npm install -g supabase
```

### Passo 2: Login e Link do Projeto
```bash
# Login no Supabase
supabase login

# Linkar ao projeto (se ainda não estiver linkado)
supabase link --project-ref dgweztejbixowxmfizgx
```

### Passo 3: Verificar Secrets Atuais
```bash
supabase secrets list
```

**Secrets Obrigatórias:**
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SERVICE_ROLE_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`

### Passo 4: Configurar Secrets (se necessário)
```bash
# Stripe Secret Key (pegar no Stripe Dashboard)
supabase secrets set STRIPE_SECRET_KEY=sk_test_XXXXX

# Webhook Secret (pegar no Stripe Dashboard → Webhooks)
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_XXXXX

# Service Role Key (pegar no Supabase Dashboard → Settings → API)
supabase secrets set SERVICE_ROLE_KEY=eyJXXXXX
```

### Passo 5: Atualizar Código das Edge Functions

**Arquivo 1:** `supabase/functions/check-subscription/index.ts`
Linha 66 - Alterar:
```typescript
// DE:
const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

// PARA:
const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });
```

**Arquivo 2:** `supabase/functions/stripe-webhook/index.ts`
Linha 40 - Mesma alteração

**Arquivo 3:** `supabase/functions/create-checkout/index.ts`
Linha 82 - Mesma alteração

### Passo 6: Deploy das Edge Functions
```bash
# Deploy do webhook SEM verificação JWT (CRÍTICO!)
supabase functions deploy stripe-webhook --no-verify-jwt

# Deploy das outras funções
supabase functions deploy check-subscription
supabase functions deploy create-checkout
```

### Passo 7: Verificar Deploy
```bash
# Listar funções deployadas
supabase functions list
```

### Passo 8: Testar Webhook (via Stripe CLI)
```bash
# Instalar Stripe CLI se necessário
# https://stripe.com/docs/stripe-cli

# Testar webhook
stripe trigger checkout.session.completed
```

### Passo 9: Verificar Logs
```bash
# Ver logs das funções
supabase functions logs stripe-webhook
supabase functions logs check-subscription
```

---

## Onde Obter os Secrets

### STRIPE_SECRET_KEY
1. Acesse: https://dashboard.stripe.com/test/apikeys
2. Copie "Secret key" (começa com `sk_test_` ou `sk_live_`)

### STRIPE_WEBHOOK_SECRET
1. Acesse: https://dashboard.stripe.com/test/webhooks
2. Clique no webhook endpoint
3. Clique em "Reveal" no "Signing secret" (começa com `whsec_`)

### SERVICE_ROLE_KEY
1. Acesse: https://supabase.com/dashboard/project/dgweztejbixowxmfizgx/settings/api
2. Copie "service_role key" (JWT longo começando com `eyJ`)

---

## Ordem de Execução

1. ✅ Verificar se `STRIPE_WEBHOOK_SECRET` está configurado
2. ✅ Desabilitar JWT verification no webhook
3. ✅ Atualizar API version nos 3 arquivos
4. ✅ Redeployar as Edge Functions
5. ✅ Testar webhook (reenviar evento do Stripe Dashboard)
6. ✅ Testar check-subscription (botão Verificar Assinatura)
7. ✅ Verificar banco de dados
