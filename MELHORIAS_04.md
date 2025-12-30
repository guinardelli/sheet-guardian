# Plano de Correção: Sincronização de Assinatura Stripe

## 🔴 Problema Identificado

Após o usuário completar o pagamento no Stripe Checkout com cartão de teste (4242 4242 4242 4242):
- ✅ Pagamento processado com sucesso
- ✅ Mensagem de sucesso exibida na interface
- ❌ **Conta continua mostrando plano "Gratuito"**
- ❌ **Nenhum email de confirmação foi enviado**

### Diagnóstico Técnico

**Estado do Banco de Dados:**
```sql
user_id: 393589b0-a7f4-4708-8f40-68f68b8d920d
plan: "free"                      ❌ (deveria ser "premium")
payment_status: "active"          ✓
stripe_customer_id: "cus_Tex9IQFQjenXJI"  ✓
stripe_subscription_id: null      ❌ (deveria ter valor)
stripe_product_id: "prod_TaJsysi99Q1g2J" ✓ (Premium)
updated_at: 2025-12-30 04:31:09
```

**Logs das Edge Functions:**
- `create-checkout`: **200 OK** ✓ (funcionou corretamente)
- `stripe-webhook`: **401 UNAUTHORIZED** ❌ (CRÍTICO - validação falhando)
- `check-subscription`: **500 ERROR** ❌ (função de fallback falhando)

### Causas Raízes

1. **Webhook do Stripe retornando 401**
   - `STRIPE_WEBHOOK_SECRET` incorreto ou não configurado no Supabase
   - Por isso, os eventos do Stripe (`checkout.session.completed`, etc) não são processados
   - Consequência: `stripe_subscription_id` permanece null e `plan` não é atualizado

2. **check-subscription retornando 500**
   - Função de fallback que deveria sincronizar após retorno do checkout está falhando
   - Provavelmente erro ao chamar API do Stripe ou ao atualizar banco de dados
   - Consequência: Nenhum dos dois caminhos (webhook + fallback) funciona

3. **Ausência de email de confirmação**
   - Sistema não implementa envio de email após upgrade bem-sucedido
   - Usuário não tem confirmação externa do pagamento

---

## 📋 Plano de Implementação

### 🔥 Fase 1: Correções Críticas (P0 - Bloqueadores)

#### 1.1 Configurar Webhook do Stripe
**Arquivo**: Configuração Supabase + Stripe Dashboard

**Passos:**
1. Verificar se `STRIPE_WEBHOOK_SECRET` existe nas Secrets do Supabase
   - Acessar Supabase Dashboard → Project Settings → Edge Functions → Secrets
   - Se não existir, obter do Stripe Dashboard

2. Configurar endpoint no Stripe Dashboard
   - URL: `https://dgweztejbixowxmfizgx.supabase.co/functions/v1/stripe-webhook`
   - Eventos necessários:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
   - Copiar Webhook Signing Secret e adicionar ao Supabase

3. Testar webhook com Stripe CLI:
   ```bash
   stripe listen --forward-to https://dgweztejbixowxmfizgx.supabase.co/functions/v1/stripe-webhook
   stripe trigger checkout.session.completed
   ```

#### 1.2 Corrigir Erro 500 em check-subscription
**Arquivo**: `supabase/functions/check-subscription/index.ts`

**Modificações:**
```typescript
// Adicionar no início da função (após linha 45)
try {
  console.log('[check-subscription] Iniciando verificação para usuário:', user.id);

  // Código existente...
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2024-12-18.acacia",
  });

  console.log('[check-subscription] Buscando cliente no Stripe...');
  // ... resto do código

} catch (error) {
  console.error('[check-subscription] Erro:', error);

  return new Response(
    JSON.stringify({
      subscribed: false,
      error: error.message,
      details: 'Erro ao verificar assinatura. Tente novamente em alguns segundos.'
    }),
    {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}
```

**Adicionar logs detalhados:**
- Antes de cada chamada ao Stripe
- Após cada operação no banco de dados
- Em cada catch de erro

#### 1.3 Melhorar Logs do Webhook
**Arquivo**: `supabase/functions/stripe-webhook/index.ts`

**Modificações:**
```typescript
// Adicionar no início da função (linha ~40)
console.log('[stripe-webhook] Recebendo webhook, evento:', event.type);
console.log('[stripe-webhook] Event ID:', event.id);

// Adicionar após cada atualização do banco
console.log('[stripe-webhook] Subscription atualizada:', {
  userId,
  plan,
  payment_status,
  stripe_subscription_id
});
```

### ⚡ Fase 2: Melhorias de Experiência (P1 - Importantes)

#### 2.1 Adicionar Retry Manual e Feedback Claro
**Arquivo**: `src/pages/Plans.tsx`

**Modificações:**

```typescript
// Adicionar após linha 80 (função checkStripeSubscription)
const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'error'>('idle');
const [syncError, setSyncError] = useState<string | null>(null);

const checkStripeSubscription = async () => {
  if (!session?.access_token) return;

  setSyncStatus('loading');
  setSyncError(null);

  try {
    const { data, error } = await supabase.functions.invoke('check-subscription', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      console.error('Erro ao verificar assinatura:', error);
      setSyncError('Não foi possível verificar sua assinatura. Por favor, tente novamente.');
      setSyncStatus('error');
      toast.error('Erro ao verificar assinatura', {
        description: 'Clique em "Verificar Assinatura" para tentar novamente.',
      });
      return;
    }

    if (data?.subscribed) {
      setSyncStatus('idle');
      toast.success('Assinatura confirmada!', {
        description: `Seu plano ${data.plan} está ativo.`,
      });
      refetch();
    } else {
      setSyncStatus('error');
      setSyncError('Assinatura não encontrada. Aguarde alguns minutos e tente novamente.');
    }
  } catch (err) {
    setSyncStatus('error');
    setSyncError('Erro ao conectar com servidor.');
    console.error(err);
  }
};
```

**Adicionar botão de verificação manual:**
```typescript
// Adicionar após plano atual (linha ~250)
{subscription?.plan !== 'free' && (
  <Button
    variant="outline"
    onClick={checkStripeSubscription}
    disabled={syncStatus === 'loading'}
  >
    {syncStatus === 'loading' ? 'Verificando...' : 'Verificar Assinatura'}
  </Button>
)}

{syncError && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>{syncError}</AlertDescription>
  </Alert>
)}
```

#### 2.2 Implementar Email de Confirmação
**Arquivo**: `supabase/functions/stripe-webhook/index.ts`

**Modificações:**
```typescript
// Adicionar após atualização da subscription (linha ~145)
async function sendUpgradeEmail(userId: string, plan: string) {
  try {
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('email')
      .eq('user_id', userId)
      .single();

    if (!profile?.email) return;

    // Usar Supabase Auth para enviar email customizado
    const emailHtml = `
      <h2>Upgrade Confirmado!</h2>
      <p>Parabéns! Seu plano foi atualizado para <strong>${plan}</strong>.</p>
      <p>Você agora tem acesso a todos os benefícios do plano ${plan}.</p>
      <p>Obrigado por escolher Sheet Guardian!</p>
    `;

    // Implementar com Resend, SendGrid ou serviço de email
    console.log('[stripe-webhook] Email de confirmação enviado para:', profile.email);
  } catch (error) {
    console.error('[stripe-webhook] Erro ao enviar email:', error);
  }
}

// Chamar após atualização bem-sucedida
if (session.payment_status === 'paid') {
  await updateSubscription(...);
  await sendUpgradeEmail(userId, plan);
}
```

#### 2.3 Criar Componente de Status de Assinatura
**Arquivo novo**: `src/components/SubscriptionStatus.tsx`

```typescript
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface SubscriptionStatusProps {
  plan: 'free' | 'professional' | 'premium';
  paymentStatus: string;
  stripeSubscriptionId: string | null;
  onVerify: () => void;
}

export function SubscriptionStatus({
  plan,
  paymentStatus,
  stripeSubscriptionId,
  onVerify
}: SubscriptionStatusProps) {
  const isActive = paymentStatus === 'active' && stripeSubscriptionId;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Status da Assinatura</h3>
          <p className="text-sm text-muted-foreground">
            Plano: <Badge>{plan}</Badge>
          </p>
        </div>
        {isActive ? (
          <CheckCircle className="h-6 w-6 text-green-500" />
        ) : (
          <XCircle className="h-6 w-6 text-yellow-500" />
        )}
      </div>

      {!isActive && plan !== 'free' && (
        <div className="mt-4">
          <p className="text-sm text-yellow-600">
            Assinatura pendente de confirmação
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={onVerify}
            className="mt-2"
          >
            Verificar Status
          </Button>
        </div>
      )}
    </Card>
  );
}
```

### 🎨 Fase 3: Polimento e Robustez (P2 - Desejável)

#### 3.1 Adicionar Retry Automático para Webhooks
**Arquivo**: `supabase/functions/stripe-webhook/index.ts`

- Implementar retry logic com exponential backoff
- Armazenar eventos falhados em tabela `webhook_failures`
- Criar job de reprocessamento

#### 3.2 Página de Admin/Debug
**Arquivo novo**: `src/pages/Admin.tsx`

- Visualizar eventos de webhook recentes
- Forçar sincronização de todas as subscriptions
- Ver logs de erros

#### 3.3 Testes Automatizados
**Arquivo novo**: `src/test/stripe-flow.test.ts`

- Testar fluxo completo de checkout
- Mockar webhooks do Stripe
- Validar atualização de subscription

---

## 📁 Arquivos a Modificar

### Backend (Supabase Functions)
1. ✏️ `supabase/functions/stripe-webhook/index.ts` - Adicionar logs e email
2. ✏️ `supabase/functions/check-subscription/index.ts` - Corrigir erro 500, adicionar logs

### Frontend
3. ✏️ `src/pages/Plans.tsx` - Adicionar retry manual e feedback
4. ➕ `src/components/SubscriptionStatus.tsx` - Novo componente de status

### Configuração
5. ⚙️ Supabase Dashboard - Adicionar `STRIPE_WEBHOOK_SECRET`
6. ⚙️ Stripe Dashboard - Configurar webhook endpoint
7. 📝 `WEBHOOK_SETUP.md` - Documentar processo (novo)

### Database (se necessário)
8. ➕ Migration para tabela `webhook_failures` (opcional, Fase 3)

---

## ✅ Checklist de Implementação

### Fase 1 - Crítico
- [ ] Verificar/configurar `STRIPE_WEBHOOK_SECRET` no Supabase
- [ ] Registrar webhook endpoint no Stripe Dashboard
- [ ] Testar webhook com Stripe CLI
- [ ] Adicionar try/catch e logs em `check-subscription`
- [ ] Adicionar logs detalhados em `stripe-webhook`
- [ ] Testar fluxo completo com cartão de teste
- [ ] Verificar que `stripe_subscription_id` é preenchido
- [ ] Verificar que `plan` é atualizado corretamente

### Fase 2 - Importante
- [ ] Adicionar estado de sincronização em `Plans.tsx`
- [ ] Implementar botão "Verificar Assinatura"
- [ ] Adicionar mensagens de erro específicas
- [ ] Implementar envio de email de confirmação
- [ ] Criar componente `SubscriptionStatus`
- [ ] Testar todos os cenários de erro

### Fase 3 - Desejável
- [ ] Implementar retry automático
- [ ] Criar página de admin/debug
- [ ] Adicionar testes automatizados
- [ ] Documentar processo de setup

---

## 🧪 Plano de Testes

### Teste 1: Webhook Funcionando
1. Configurar webhook corretamente
2. Fazer checkout com cartão de teste
3. Verificar logs: webhook deve retornar 200 (não 401)
4. Verificar banco: `plan` deve ser atualizado, `stripe_subscription_id` preenchido

### Teste 2: Fallback (check-subscription)
1. Desabilitar webhook temporariamente
2. Fazer checkout
3. Retornar com `?success=true`
4. Verificar que `check-subscription` sincroniza corretamente

### Teste 3: Email de Confirmação
1. Fazer checkout bem-sucedido
2. Verificar que email foi enviado (check logs)
3. Validar conteúdo do email

### Teste 4: Cenários de Erro
1. Teste com cartão que falha (4000 0000 0000 0002)
2. Verificar mensagens de erro apropriadas
3. Testar botão "Verificar Assinatura"

---

## 📊 Métricas de Sucesso

- ✅ Webhook do Stripe retorna 200 (não 401)
- ✅ `check-subscription` retorna 200 (não 500)
- ✅ Subscription atualizada em ambos os caminhos (webhook + fallback)
- ✅ Email de confirmação enviado
- ✅ Usuário vê plano correto imediatamente após pagamento
- ✅ Logs detalhados para debugging
- ✅ Mensagens de erro claras e acionáveis

---

## 🔗 Recursos e Referências

- [Stripe Webhook Documentation](https://stripe.com/docs/webhooks)
- [Supabase Edge Functions Secrets](https://supabase.com/docs/guides/functions/secrets)
- [Stripe Testing Cards](https://stripe.com/docs/testing)
- Código existente: `supabase/functions/stripe-webhook/index.ts:1-220`
- Código existente: `supabase/functions/check-subscription/index.ts:1-150`

---

## 📝 Próximos Passos

1. ✅ Criar arquivo `MELHORIAS_04.md` no diretório raiz do projeto
2. Começar implementação pela Fase 1 (correções críticas)
3. Testar cada fase antes de prosseguir para a próxima

---

**Data de Criação**: 2025-12-30
**Versão**: 1.0
**Autor**: Claude Code com análise via MCPs (Supabase, Sequential Thinking, Explore Agents)
