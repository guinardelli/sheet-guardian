# MELHORIA 01 - Correção do Sistema de Assinaturas

**Data**: 2025-12-30
**Prioridade**: CRÍTICA
**Status**: Planejado

---

## 📋 Sumário Executivo

Usuários estão enfrentando problemas ao acessar suas informações de assinatura na página `/account`. A mensagem "Não foi possível carregar as informações do plano" aparece, e os botões de criação/mudança de assinatura não funcionam.

### Causa Raiz
1. **Migration não aplicada**: A função RPC `create_missing_subscription` não existe no banco de produção
2. **Dados inconsistentes**: Existe(m) usuário(s) sem registro de subscription no banco
3. **Código com dependência quebrada**: O código frontend depende de uma função RPC que não foi deployada

### Impacto
- Usuários não conseguem visualizar suas informações de plano
- Usuários não conseguem mudar de plano
- Experiência do usuário degradada
- Possível perda de conversão para planos pagos

---

## 🔍 Análise Detalhada

### Problema 1: Função RPC Ausente

**Arquivo**: `supabase/migrations/20251229_create_missing_subscription_rpc.sql`
**Status**: Migration criada mas NÃO aplicada ao banco de produção

**Evidência**:
```sql
-- Consulta ao banco retornou lista de funções sem 'create_missing_subscription'
SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public';
-- Resultado: handle_new_user, update_updated_at_column, check_rate_limit, etc.
-- FALTANDO: create_missing_subscription
```

**Código que depende desta função**:
- `src/hooks/useSubscription.tsx:93-95` - Chama RPC quando subscription não é encontrada
- `src/pages/Account.tsx:132-136` - Botão "Criar assinatura" chama refetch que depende do RPC

### Problema 2: Usuários Sem Subscription

**Evidência**:
```sql
-- Consulta identificou usuário sem subscription
SELECT u.email, s.id FROM auth.users u LEFT JOIN subscriptions s ON s.user_id = u.id;
-- Resultado: estruturas.gn@gmail.com -> SEM SUBSCRIPTION
```

**Por que aconteceu**:
- Usuário pode ter sido criado antes do trigger `handle_new_user` ser implementado
- Ou houve falha na execução do trigger durante criação
- Ou subscription foi deletada manualmente

### Problema 3: Fluxo de Recuperação Quebrado

**Fluxo Esperado**:
1. Usuário acessa `/account`
2. Hook `useSubscription` busca subscription
3. Se não encontrar, chama RPC `create_missing_subscription`
4. Subscription é criada automaticamente
5. Página recarrega e mostra informações

**Fluxo Atual** (QUEBRADO):
1. Usuário acessa `/account`
2. Hook `useSubscription` busca subscription
3. Não encontra
4. Tenta chamar RPC `create_missing_subscription`
5. ❌ RPC não existe → Erro silencioso
6. Página mostra erro e botão "Criar assinatura"
7. Usuário clica no botão
8. ❌ Mesmo erro → Nada acontece

**Código afetado**:

`src/hooks/useSubscription.tsx:78-121`:
```typescript
const fetchSubscription = useCallback(async () => {
  // ... busca subscription
  if (!data) {
    // Tenta criar via RPC que NÃO EXISTE
    const { error: rpcError } = await supabase.rpc('create_missing_subscription', {
      p_user_id: user.id,
    });
    // Erro silencioso - não há feedback ao usuário
  }
}, [user]);
```

`src/pages/Plans.tsx:140-160`:
```typescript
if (plan === 'free') {
  try {
    // Tenta atualizar subscription que NÃO EXISTE
    const result = await updatePlan('free');
    // Mostra sucesso mas nada acontece
    toast({ title: 'Plano atualizado!', description: 'Você está no plano Gratuito.' });
  } catch (error) {
    // ...
  }
}
```

---

## ✅ Solução Proposta

### Abordagem: Híbrida (Correção + Prevenção + Melhorias)

#### FASE 1: Correção Imediata no Banco de Dados (URGENTE)

**Objetivo**: Resolver problema existente para todos os usuários afetados

**Ações**:

1. **Aplicar Migration da Função RPC**

   **Como fazer**:
   - Via Supabase Dashboard: SQL Editor → Execute migration
   - Via Supabase CLI: `supabase db push`

   **SQL a executar**:
   ```sql
   -- Conteúdo de: supabase/migrations/20251229_create_missing_subscription_rpc.sql
   CREATE OR REPLACE FUNCTION public.create_missing_subscription(p_user_id uuid)
   RETURNS void
   SECURITY DEFINER
   SET search_path = public
   AS $$
   BEGIN
     INSERT INTO subscriptions (
       user_id,
       plan,
       payment_status,
       sheets_used_today,
       sheets_used_week,
       sheets_used_month
     )
     VALUES (p_user_id, 'free', 'active', 0, 0, 0)
     ON CONFLICT (user_id) DO NOTHING;
   END;
   $$ LANGUAGE plpgsql;
   ```

2. **Criar Subscriptions para Usuários Afetados**

   **SQL a executar**:
   ```sql
   -- Inserir subscription gratuita para todos os usuários sem subscription
   INSERT INTO public.subscriptions (
     user_id,
     plan,
     payment_status,
     sheets_used_today,
     sheets_used_week,
     sheets_used_month
   )
   SELECT
     u.id,
     'free'::subscription_plan,
     'active',
     0,
     0,
     0
   FROM auth.users u
   LEFT JOIN public.subscriptions s ON s.user_id = u.id
   WHERE s.id IS NULL
   ON CONFLICT (user_id) DO NOTHING;
   ```

3. **Validar Integridade dos Dados**

   **SQL de validação**:
   ```sql
   -- Deve retornar 0 (zero)
   SELECT COUNT(*) as usuarios_sem_subscription
   FROM auth.users u
   LEFT JOIN public.subscriptions s ON s.user_id = u.id
   WHERE s.id IS NULL;

   -- Deve retornar todas as subscriptions criadas
   SELECT
     u.email,
     s.plan,
     s.payment_status,
     s.created_at
   FROM auth.users u
   INNER JOIN public.subscriptions s ON s.user_id = u.id
   ORDER BY s.created_at DESC;
   ```

**Resultado Esperado**:
- ✅ Função RPC disponível no banco
- ✅ Todos os usuários com subscription ativa
- ✅ Páginas `/account` e `/plans` funcionando normalmente

---

#### FASE 2: Melhorias no Código Frontend

**Objetivo**: Tornar o sistema mais robusto e resiliente a falhas

##### 2.1. Melhorar `src/hooks/useSubscription.tsx`

**Localização**: Linhas 78-121

**Problemas atuais**:
- Erro silencioso quando RPC falha
- Sem retry logic
- Sem fallback alternativo

**Mudanças propostas**:

```typescript
const fetchSubscription = useCallback(async () => {
  if (!user) return;

  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      logger.error('Erro ao buscar assinatura', error);
      return;
    }

    if (!data) {
      logger.warn('Subscription not found, attempting to create', undefined, { userId: user.id });

      // MELHORIA 1: Tentar via RPC primeiro
      const { error: rpcError } = await supabase.rpc('create_missing_subscription', {
        p_user_id: user.id,
      });

      if (rpcError) {
        logger.error('Erro ao criar assinatura via RPC', rpcError, { userId: user.id });

        // MELHORIA 2: FALLBACK - Tentar INSERT direto se RPC falhar
        const { error: insertError } = await supabase
          .from('subscriptions')
          .insert({
            user_id: user.id,
            plan: 'free',
            payment_status: 'active',
            sheets_used_today: 0,
            sheets_used_week: 0,
            sheets_used_month: 0,
          })
          .select()
          .single();

        if (insertError) {
          logger.error('Erro ao criar assinatura via INSERT', insertError, { userId: user.id });
          // MELHORIA 3: Mostrar erro ao usuário via toast
          toast.error('Erro ao criar assinatura', {
            description: 'Não foi possível criar sua assinatura. Por favor, entre em contato com o suporte.',
          });
          return;
        }
      }

      // MELHORIA 4: Retry para buscar subscription criada
      const { data: retryData, error: retryError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (retryError) {
        logger.error('Erro ao buscar assinatura após criação', retryError, { userId: user.id });
      } else if (retryData) {
        setSubscription(retryData as Subscription);
        logger.info('Subscription created successfully', undefined, { userId: user.id });
        // MELHORIA 5: Feedback positivo ao usuário
        toast.success('Assinatura criada com sucesso!');
      }
    } else {
      setSubscription(data as Subscription);
    }
  } catch (err) {
    logger.error('Erro inesperado ao buscar assinatura', err);
    // MELHORIA 6: Erro genérico ao usuário
    toast.error('Erro ao carregar assinatura', {
      description: 'Ocorreu um erro inesperado. Tente recarregar a página.',
    });
  } finally {
    setLoading(false);
  }
}, [user]);
```

**Benefícios**:
- ✅ Fallback para INSERT direto se RPC falhar
- ✅ Feedback claro ao usuário sobre sucesso/erro
- ✅ Logs detalhados para debug
- ✅ Retry automático após criação

##### 2.2. Melhorar `src/pages/Account.tsx`

**Localização**: Linhas 426-443

**Problemas atuais**:
- Mensagem genérica de erro
- Botão sem feedback durante operação
- Sem limite de tentativas

**Mudanças propostas**:

```typescript
// Adicionar estado para controle de tentativas
const [retryCount, setRetryCount] = useState(0);
const [lastError, setLastError] = useState<string | null>(null);

const handleRetrySubscription = async () => {
  if (retryCount >= 3) {
    toast.error('Limite de tentativas atingido', {
      description: 'Por favor, entre em contato com o suporte em suporte@sheetguardian.com',
    });
    return;
  }

  setRetrying(true);
  setRetryCount(prev => prev + 1);

  try {
    await refetchSubscription();

    // Verificar se subscription foi criada
    if (subscription) {
      toast.success('Assinatura criada com sucesso!');
      setRetryCount(0);
      setLastError(null);
    } else {
      setLastError('Não foi possível criar a assinatura.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    setLastError(message);
    toast.error('Erro ao criar assinatura', { description: message });
  } finally {
    setRetrying(false);
  }
};

// No JSX:
{!subscription ? (
  <div className="text-muted-foreground space-y-3">
    <p>Não foi possível carregar as informações do plano.</p>
    {lastError && (
      <p className="text-xs text-destructive">
        Erro: {lastError}
      </p>
    )}
    <p className="text-xs text-muted-foreground">
      Clique abaixo para criar sua assinatura gratuita.
    </p>
    <Button
      variant="outline"
      size="sm"
      onClick={handleRetrySubscription}
      disabled={retrying || retryCount >= 3}
    >
      {retrying ? (
        <>
          <LoadingSpinner />
          Criando assinatura...
        </>
      ) : retryCount >= 3 ? (
        'Limite atingido - Contate o suporte'
      ) : (
        <>
          <RefreshCw className="h-4 w-4 mr-2" />
          Criar assinatura {retryCount > 0 ? `(Tentativa ${retryCount}/3)` : ''}
        </>
      )}
    </Button>
  </div>
) : (
  // ... conteúdo normal da subscription
)}
```

**Benefícios**:
- ✅ Limite de 3 tentativas para evitar loops infinitos
- ✅ Mensagem clara sobre erro específico
- ✅ Feedback visual durante operação
- ✅ Instrução para contatar suporte após falhas

##### 2.3. Melhorar `src/pages/Plans.tsx`

**Localização**: Linhas 140-160

**Problemas atuais**:
- Tenta atualizar subscription que pode não existir
- Mostra sucesso mesmo quando falha
- Sem validação prévia

**Mudanças propostas**:

```typescript
const handleSelectPlan = async (plan: 'free' | 'professional' | 'premium') => {
  if (!user) {
    toast({
      title: 'Crie sua conta',
      description: `Crie uma conta gratuita para ${
        plan === 'free' ? 'começar a usar' : `assinar o plano ${PLAN_INFO[plan].name}`
      }.`,
    });
    navigate('/auth');
    return;
  }

  if (plan === 'free') {
    try {
      // MELHORIA 1: Verificar se subscription existe antes de atualizar
      if (!subscription) {
        toast({
          title: 'Criando assinatura...',
          description: 'Aguarde enquanto criamos sua assinatura gratuita.',
        });

        // MELHORIA 2: Criar subscription primeiro
        await refetch(); // Isso vai acionar a criação via useSubscription

        // Aguardar um pouco para garantir que foi criada
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Recarregar subscription
        await refetch();

        // Verificar se foi criada
        if (!subscription) {
          throw new Error('Não foi possível criar sua assinatura. Por favor, tente novamente ou contate o suporte.');
        }
      }

      // MELHORIA 3: Atualizar plano somente se subscription existe
      const result = await updatePlan('free');

      if (!result.success) {
        throw new Error(result.error || 'Erro ao atualizar plano gratuito');
      }

      toast({
        title: 'Plano atualizado!',
        description: 'Você está no plano Gratuito.',
      });

      navigate('/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tente novamente mais tarde.';
      toast({
        title: 'Erro ao mudar para plano gratuito',
        description: message,
        variant: 'destructive',
      });

      // MELHORIA 4: Log para debug
      logger.error('Error switching to free plan', error, { userId: user.id });
    }
    return;
  }

  // ... resto do código para planos pagos
};
```

**Benefícios**:
- ✅ Validação antes de atualizar
- ✅ Criação automática se subscription não existir
- ✅ Mensagens de erro reais ao invés de sucesso falso
- ✅ Logs para troubleshooting

---

#### FASE 3: Prevenção de Problemas Futuros

##### 3.1. Validar Trigger de Criação Automática

**Objetivo**: Garantir que novos usuários sempre tenham subscription

**Validação**:
```sql
-- Verificar se trigger existe e está ativo
SELECT
  trigger_name,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Resultado esperado:
-- trigger_name: on_auth_user_created
-- event_object_table: users
-- action_statement: EXECUTE FUNCTION handle_new_user()
-- action_timing: AFTER
```

**Se trigger não existir**, recriar:
```sql
-- Já existe em: supabase/migrations/20251208120034_2a6da247-0e82-4cc3-89c2-a6b8c1870ea9.sql
-- Linhas 96-98

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

##### 3.2. Adicionar Health Check Endpoint

**Arquivo novo**: `supabase/functions/health-check/index.ts`

**Objetivo**: Endpoint para monitorar integridade dos dados

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Verificar usuários sem subscription
  const { data: usersWithoutSub, error } = await supabase
    .from('auth.users')
    .select('id, email')
    .filter('id', 'not.in', `(SELECT user_id FROM subscriptions)`);

  if (error) {
    return new Response(
      JSON.stringify({ status: 'error', error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const healthStatus = {
    status: usersWithoutSub.length === 0 ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    usersWithoutSubscription: usersWithoutSub.length,
    details: usersWithoutSub.length > 0 ? usersWithoutSub : undefined,
  };

  return new Response(JSON.stringify(healthStatus), {
    status: healthStatus.status === 'healthy' ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
});
```

**Uso**:
- Chamar periodicamente (ex: via cron job)
- Integrar com Sentry para alertas
- Dashboard de monitoramento

##### 3.3. Adicionar Monitoramento no Sentry

**Arquivo**: `src/lib/error-tracker.ts` (já existe)

**Adicionar nova função**:
```typescript
export const trackSubscriptionIssue = (userId: string, issue: string) => {
  if (import.meta.env.PROD) {
    Sentry.captureMessage(`Subscription Issue: ${issue}`, {
      level: 'warning',
      tags: {
        component: 'subscription',
        issue_type: issue,
      },
      user: { id: userId },
    });
  } else {
    logger.warn('Subscription Issue', undefined, { userId, issue });
  }
};
```

**Usar em `useSubscription.tsx`**:
```typescript
if (!data) {
  trackSubscriptionIssue(user.id, 'subscription_not_found');
  // ... resto do código de criação
}
```

**Configurar alerta no Sentry**:
- Issue search: `Subscription Issue`
- Alert: Email quando > 5 ocorrências em 1 hora
- Assign: Time de backend

##### 3.4. Adicionar Testes Automatizados

**Arquivo novo**: `src/test/subscription.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client');

describe('useSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create subscription when user has none', async () => {
    // Mock: Usuário existe mas subscription não
    const mockUser = { id: 'user-123', email: 'test@example.com' };

    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any);

    // Mock: RPC cria subscription
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ error: null, data: null });

    // Mock: Busca subscription criada
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'sub-123', user_id: 'user-123', plan: 'free' },
        error: null,
      }),
    } as any);

    const { result } = renderHook(() => useSubscription(), {
      wrapper: ({ children }) => (
        <AuthProvider value={{ user: mockUser }}>{children}</AuthProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.subscription).toBeTruthy();
      expect(result.current.subscription?.plan).toBe('free');
    });
  });

  it('should fallback to INSERT if RPC fails', async () => {
    // Mock: RPC falha
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      error: { message: 'Function not found' },
      data: null
    });

    // Mock: INSERT direto funciona
    vi.mocked(supabase.from).mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'sub-123', user_id: 'user-123', plan: 'free' },
        error: null,
      }),
    } as any);

    // Executar hook e validar que subscription foi criada via fallback
    // ...
  });
});
```

**Rodar testes**:
```bash
npm test -- --run subscription.test.ts
```

---

## 📊 Checklist de Implementação

### FASE 1: Correção Imediata ⚠️ URGENTE

- [ ] **1.1** Backup do banco de dados de produção
- [ ] **1.2** Aplicar migration da função RPC via Supabase Dashboard
  - Copiar SQL de `supabase/migrations/20251229_create_missing_subscription_rpc.sql`
  - Executar no SQL Editor do Supabase
  - Validar: `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'create_missing_subscription'`
- [ ] **1.3** Criar subscriptions para usuários sem subscription
  - Executar SQL de correção (ver Fase 1, item 2)
  - Validar: `SELECT COUNT(*) FROM auth.users u LEFT JOIN subscriptions s ON u.id = s.user_id WHERE s.id IS NULL` → Deve retornar 0
- [ ] **1.4** Testar manualmente
  - Acessar https://vbablocker.vercel.app/account
  - Verificar que plano aparece corretamente
  - Testar mudança de plano em https://vbablocker.vercel.app/plans
- [ ] **1.5** Validar logs no Sentry
  - Verificar se erros de "subscription not found" pararam

**Tempo estimado**: 30 minutos
**Responsável**: DevOps / Backend

### FASE 2: Melhorias no Código 🔧

- [ ] **2.1** Modificar `src/hooks/useSubscription.tsx`
  - Adicionar fallback para INSERT direto
  - Adicionar toasts de feedback
  - Melhorar logging
  - Testar localmente com subscription inexistente
- [ ] **2.2** Modificar `src/pages/Account.tsx`
  - Adicionar contador de tentativas
  - Melhorar mensagens de erro
  - Adicionar limite de tentativas
  - Testar UX de erro
- [ ] **2.3** Modificar `src/pages/Plans.tsx`
  - Adicionar validação de subscription
  - Criar subscription antes de updatePlan se necessário
  - Melhorar mensagens de erro
  - Testar fluxo completo de mudança de plano
- [ ] **2.4** Code review
  - Revisar mudanças com time
  - Validar tratamento de erros
  - Validar UX
- [ ] **2.5** Deploy para staging
  - Testar cenários de erro
  - Validar que melhorias funcionam
- [ ] **2.6** Deploy para produção
  - Monitorar logs por 24h
  - Validar métricas de erro no Sentry

**Tempo estimado**: 4-6 horas
**Responsável**: Frontend

### FASE 3: Prevenção Futura 🛡️

- [ ] **3.1** Validar trigger `on_auth_user_created`
  - Executar SQL de validação
  - Recriar se necessário
  - Testar criação de novo usuário
- [ ] **3.2** Criar health check endpoint
  - Implementar Edge Function
  - Deploy para Supabase
  - Testar endpoint
- [ ] **3.3** Configurar monitoramento Sentry
  - Adicionar `trackSubscriptionIssue` ao código
  - Configurar alerta no Sentry
  - Testar alerta
- [ ] **3.4** Adicionar testes automatizados
  - Implementar testes em `subscription.test.ts`
  - Rodar testes localmente
  - Adicionar ao CI/CD
- [ ] **3.5** Documentar processo
  - Atualizar CLAUDE.md com lições aprendidas
  - Criar runbook para troubleshooting
  - Documentar processo de recovery

**Tempo estimado**: 6-8 horas
**Responsável**: Full Stack

---

## 🧪 Testes de Validação

### Teste 1: Criação Automática de Subscription

**Pré-condição**: Banco com função RPC aplicada

**Passos**:
1. Criar novo usuário via signup
2. Confirmar email
3. Fazer login
4. Acessar `/account`

**Resultado esperado**:
- ✅ Subscription criada automaticamente
- ✅ Plano "Gratuito" visível
- ✅ Nenhum erro no console
- ✅ Nenhum erro no Sentry

### Teste 2: Recovery de Usuário Sem Subscription

**Pré-condição**: Usuário existente sem subscription (criar manualmente no banco para teste)

**Passos**:
1. Fazer login com usuário sem subscription
2. Acessar `/account`
3. Observar mensagem de erro
4. Clicar em "Criar assinatura"

**Resultado esperado**:
- ✅ Toast de sucesso "Assinatura criada com sucesso!"
- ✅ Página recarrega e mostra plano "Gratuito"
- ✅ Subscription criada no banco
- ✅ Log de sucesso no logger

### Teste 3: Mudança de Plano Sem Subscription

**Pré-condição**: Usuário sem subscription (criar manualmente no banco para teste)

**Passos**:
1. Fazer login
2. Acessar `/plans`
3. Clicar em "Mudar para Gratuito"

**Resultado esperado**:
- ✅ Toast "Criando assinatura..."
- ✅ Aguarda criação
- ✅ Toast "Plano atualizado!"
- ✅ Redirecionamento para `/dashboard`
- ✅ Subscription criada no banco com plano "free"

### Teste 4: Fallback quando RPC Falha

**Pré-condição**: Temporariamente dropar função RPC no banco de teste

**Passos**:
1. Dropar função: `DROP FUNCTION IF EXISTS create_missing_subscription;`
2. Criar usuário sem subscription
3. Fazer login
4. Acessar `/account`
5. Clicar em "Criar assinatura"

**Resultado esperado**:
- ✅ Log de erro sobre RPC
- ✅ Fallback para INSERT direto
- ✅ Toast de sucesso
- ✅ Subscription criada no banco
- ✅ Página funciona normalmente

### Teste 5: Limite de Tentativas

**Pré-condição**: Forçar erro contínuo (ex: remover permissões de INSERT)

**Passos**:
1. Configurar erro forçado
2. Fazer login com usuário sem subscription
3. Acessar `/account`
4. Clicar em "Criar assinatura" 3 vezes

**Resultado esperado**:
- ✅ Tentativa 1/3
- ✅ Tentativa 2/3
- ✅ Tentativa 3/3
- ✅ Botão desabilitado após 3 tentativas
- ✅ Mensagem "Limite atingido - Contate o suporte"

---

## 📈 Métricas de Sucesso

### Métricas Imediatas (Após Fase 1)

- **Usuários sem subscription**: 0 (zero)
- **Erro "subscription not found" no Sentry**: Redução de 100%
- **Taxa de sucesso de acesso a `/account`**: 100%
- **Taxa de sucesso de mudança de plano**: 100%

### Métricas de Médio Prazo (Após Fase 2 + 3)

- **Tempo médio para criação de subscription**: < 2 segundos
- **Taxa de erro em criação de subscription**: < 0.1%
- **Tempo de detecção de problemas**: < 1 hora (via health check)
- **Cobertura de testes de subscription**: > 80%

### Indicadores de Monitoramento

- **Sentry**: Issues tagged com `subscription`
- **Health Check**: `/functions/v1/health-check` status
- **Database**: Query diária de usuários sem subscription
- **User Feedback**: Tickets de suporte relacionados a assinatura

---

## 🚨 Rollback Plan

Se algo der errado após deploy:

### Rollback Fase 1 (Banco de Dados)

**NÃO FAZER ROLLBACK** - A função RPC e as subscriptions criadas não causam problemas se o código não usar.

**Se absolutamente necessário**:
```sql
-- CUIDADO: Só usar se tiver certeza
DROP FUNCTION IF EXISTS public.create_missing_subscription(uuid);

-- NÃO deletar subscriptions criadas - isso vai quebrar usuários!
```

### Rollback Fase 2 (Código)

**Via Git**:
```bash
# Reverter commits específicos
git revert <commit-hash-useSubscription>
git revert <commit-hash-Account>
git revert <commit-hash-Plans>
git push origin main

# Ou reverter para versão anterior
git reset --hard <commit-anterior>
git push origin main --force
```

**Via Vercel**:
1. Acessar Vercel Dashboard
2. Ir em Deployments
3. Clicar em deployment anterior
4. Clicar em "Promote to Production"

### Rollback Fase 3 (Monitoramento)

**Desabilitar health check**:
```bash
supabase functions delete health-check
```

**Remover alerta Sentry**:
1. Ir em Sentry → Alerts
2. Desabilitar alerta de subscription

---

## 📚 Referências

### Arquivos Modificados

- `src/hooks/useSubscription.tsx:78-121`
- `src/pages/Account.tsx:426-443`
- `src/pages/Plans.tsx:140-160`
- `src/lib/error-tracker.ts` (adicionar função)
- `src/test/subscription.test.ts` (novo)
- `supabase/functions/health-check/index.ts` (novo)

### Migrations Relacionadas

- `supabase/migrations/20251208120034_2a6da247-0e82-4cc3-89c2-a6b8c1870ea9.sql` - Schema inicial
- `supabase/migrations/20251229_create_missing_subscription_rpc.sql` - Função RPC

### Documentação

- `CLAUDE.md` - Guia do projeto
- `README.md` - Instruções gerais
- Supabase Docs: https://supabase.com/docs
- Sentry Docs: https://docs.sentry.io

---

## ✅ Aprovação e Sign-off

### Revisores

- [ ] **Product Owner**: Aprovado para implementação
- [ ] **Tech Lead**: Revisão técnica completa
- [ ] **DevOps**: Checklist de deploy validado
- [ ] **QA**: Plano de testes aprovado

### Notas Adicionais

_Adicionar aqui quaisquer observações, riscos identificados ou dependências externas._

---

**Fim do documento MELHORIA_01.md**
**Próximos passos**: Iniciar FASE 1 (Correção Imediata) 🚀
