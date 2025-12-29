# Plano de Correção: Página "Minha Conta"

> **INSTRUÇÕES PARA IMPLEMENTAÇÃO**: Este documento contém a análise completa e o plano de implementação detalhado para corrigir os problemas da página "Minha Conta" (Account). Leia todo o documento antes de começar a implementação. Siga a ordem de implementação recomendada na seção correspondente.

## Análise Profunda dos Problemas

### Problema 1: "Não foi possível carregar as informações do plano"

**Causa Raiz Identificada:**

Analisando [Account.tsx:306-378](src/pages/Account.tsx#L306-L378), o erro aparece quando `subscription` é `null` (linha 365). Isso ocorre quando:

1. **Hook useSubscription retorna null**: [useSubscription.tsx:78-98](src/hooks/useSubscription.tsx#L78-L98) faz query no Supabase mas pode retornar `null` se:
   - Query retornar erro (linha 88-89)
   - Não houver dados na tabela `subscriptions` para o usuário
   - Erro inesperado no try/catch (linha 93-94)

2. **Problemas Possíveis**:
   - Usuário criado mas sem registro de assinatura (falha no trigger automático do Supabase)
   - Row-Level Security (RLS) bloqueando acesso
   - Dados corrompidos/inválidos na tabela
   - Erro de sincronização ao criar conta

**Solução Necessária:**
- Adicionar criação automática de assinatura se não existir
- Melhorar mensagem de erro com opção de "criar assinatura"
- Adicionar logs detalhados para diagnóstico
- Implementar botão "Gerenciar Assinatura" visível quando subscription existir

### Problema 2: Redefinição de Senha não funciona

**Fluxo Atual (Quebrado):**

1. Usuário clica "Enviar Email para Redefinir Senha" → [Account.tsx:106-127](src/pages/Account.tsx#L106-L127)
2. `supabase.auth.resetPasswordForEmail()` envia email com `redirectTo: ${window.location.origin}/auth` (linha 114)
3. Supabase envia email com link tipo: `https://vbablocker.vercel.app/auth#access_token=xxx&type=recovery&...`
4. Usuário clica no link → é redirecionado para `/auth`
5. **PROBLEMA**: [Auth.tsx](src/pages/Auth.tsx) não detecta o token de recuperação na URL
6. Página mostra apenas formulários de login/cadastro normais
7. Usuário não consegue redefinir senha

**Causa Raiz:**
- Falta detecção do hash fragment `#type=recovery` na URL
- Falta formulário dedicado para atualização de senha
- Falta chamada `supabase.auth.updateUser({ password: newPassword })`
- Falta tratamento do estado de "modo recuperação"

**Solução Necessária:**
- Detectar `type=recovery` no hash da URL ao carregar Auth.tsx
- Criar novo componente `ResetPasswordForm`
- Mostrar formulário de nova senha quando em modo recuperação
- Implementar `updateUser()` para mudar senha
- Redirecionar para dashboard após sucesso

### Problema 3: Gerenciamento de Assinatura (Ausente)

**Estado Atual:**
- Botão "Gerenciar Assinatura" existe em [Plans.tsx:374-381](src/pages/Plans.tsx#L374-L381)
- Condição: `hasActiveSubscription = subscription?.plan !== 'free' && subscription.payment_status === 'active'` (linha 233-234)
- **PROBLEMA**: Este botão só aparece na página `/plans`, não em `/account`
- Usuário espera gerenciar assinatura (cancelar/upgrade) direto da página "Minha Conta"

**Solução Necessária:**
- Adicionar botão "Gerenciar Assinatura" em Account.tsx quando subscription existir e for paga
- Adicionar botão "Cancelar Plano" para planos pagos
- Adicionar botão "Fazer Upgrade" destacado para plano free/professional

---

## Plano de Implementação Detalhado

### Fase 1: Corrigir Exibição do Plano Atual

**Arquivos a Modificar:**
- [src/hooks/useSubscription.tsx](src/hooks/useSubscription.tsx) - Adicionar recuperação de subscription faltante
- [src/hooks/useSubscriptionManagement.tsx](src/hooks/useSubscriptionManagement.tsx) - **NOVO** - Hook compartilhado
- [src/pages/Account.tsx](src/pages/Account.tsx) - Melhorar UI e adicionar botões
- [supabase/migrations/](supabase/migrations/) - **NOVO** - Criar RPC function

**Mudanças:**

1. **CRÍTICO: Criar RPC Function no Supabase (Nova Migration)**
   - Criar arquivo: `supabase/migrations/[timestamp]_create_missing_subscription_rpc.sql`
   - Usar `SECURITY DEFINER` para contornar RLS (padrão seguro do Supabase)
   - Função: `create_missing_subscription(p_user_id UUID)`
   - Inserir subscription com `ON CONFLICT DO NOTHING` para evitar duplicatas

```sql
CREATE OR REPLACE FUNCTION public.create_missing_subscription(p_user_id UUID)
RETURNS void
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO subscriptions (user_id, plan, payment_status, sheets_used_today, sheets_used_week, sheets_used_month)
  VALUES (p_user_id, 'free', 'active', 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;
```

2. **useSubscription.tsx - Adicionar recuperação automática**
   - Modificar `fetchSubscription()` (linhas 78-98)
   - Se `data` for null mas não houver erro, chamar RPC para criar subscription
   - Tentar fetch novamente após criação
   - Adicionar logging para rastrear quantas vezes isso ocorre

```typescript
// Em fetchSubscription (linha 78-98)
if (error) {
  logger.error('Erro ao buscar assinatura', error);
} else if (!data) {
  // Subscription missing - attempt recovery
  logger.warn('Subscription not found, attempting to create', { userId: user.id });

  const { error: rpcError } = await supabase.rpc('create_missing_subscription', {
    p_user_id: user.id
  });

  if (!rpcError) {
    // Retry fetch after creation
    const { data: retryData, error: retryError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!retryError && retryData) {
      setSubscription(retryData as Subscription);
      logger.info('Subscription created successfully');
    }
  }
} else {
  setSubscription(data as Subscription);
}
```

3. **NOVO: useSubscriptionManagement.tsx - Hook compartilhado**
   - Criar novo arquivo para evitar duplicação de código
   - Extrair lógica de `handleManageSubscription` de Plans.tsx
   - Será usado em Plans.tsx e Account.tsx

```typescript
export const useSubscriptionManagement = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const openCustomerPortal = async () => {
    if (!session?.access_token) {
      toast({
        title: 'Sessão não encontrada',
        description: 'Por favor, faça login novamente',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('URL do portal não recebida');
      }
    } catch (error) {
      logger.error('Portal error', error);
      toast({
        title: 'Erro ao abrir portal',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return { openCustomerPortal, loading };
};
```

4. **Account.tsx - Melhorar estado de erro e adicionar botões**
   - Importar `useSubscriptionManagement`
   - Adicionar estado de retry: `const [retrying, setRetrying] = useState(false)`
   - Melhorar mensagem de erro (linha 365-378)
   - Adicionar botões de gerenciamento condicionais dentro do Card "Plano Atual"

```typescript
// Imports
import { useSubscriptionManagement } from '@/hooks/useSubscriptionManagement';

// No componente
const { openCustomerPortal, loading: portalLoading } = useSubscriptionManagement();
const [retrying, setRetrying] = useState(false);

// Função de retry melhorada
const handleRetry = async () => {
  setRetrying(true);
  await refetchSubscription();
  setRetrying(false);
};

// Dentro do Card "Plano Atual", após os limites (linha 363), adicionar:
{subscription && (
  <div className="pt-4 border-t space-y-2">
    {subscription.plan === 'free' ? (
      <Button onClick={() => navigate('/plans')} className="w-full">
        <CreditCard className="h-4 w-4 mr-2" />
        Fazer Upgrade
      </Button>
    ) : subscription.plan === 'professional' ? (
      <>
        <Button
          onClick={openCustomerPortal}
          disabled={portalLoading}
          variant="outline"
          className="w-full"
        >
          <Settings className="h-4 w-4 mr-2" />
          Gerenciar Assinatura Profissional
        </Button>
        <Button onClick={() => navigate('/plans')} className="w-full">
          <Crown className="h-4 w-4 mr-2" />
          Upgrade para Premium
        </Button>
      </>
    ) : (
      <Button
        onClick={openCustomerPortal}
        disabled={portalLoading}
        variant="outline"
        className="w-full"
      >
        <Settings className="h-4 w-4 mr-2" />
        Gerenciar Assinatura Premium
      </Button>
    )}
  </div>
)}
```

5. **Plans.tsx - Refatorar para usar hook compartilhado**
   - Substituir `handleManageSubscription` (linhas 191-220) por:
   ```typescript
   const { openCustomerPortal, loading: portalLoading } = useSubscriptionManagement();
   ```
   - Atualizar botão (linha 376) para usar `openCustomerPortal` e `portalLoading`

---

### Fase 2: Implementar Reset de Senha Funcional

**Arquivos a Modificar:**
- [src/hooks/useAuth.tsx](src/hooks/useAuth.tsx) - Adicionar handler para PASSWORD_RECOVERY
- [src/pages/Auth.tsx](src/pages/Auth.tsx) - Detectar modo de recuperação via query params
- Criar novo arquivo: [src/components/ResetPasswordForm.tsx](src/components/ResetPasswordForm.tsx)

**ABORDAGEM CORRETA (Validado pelo Supabase):**
- **NÃO** parsear manualmente o hash da URL
- **SIM** usar evento `PASSWORD_RECOVERY` do `onAuthStateChange`
- Supabase valida o token automaticamente e estabelece sessão autenticada
- Apenas coletar nova senha e chamar `updateUser()`

**Mudanças:**

1. **useAuth.tsx - Adicionar handler PASSWORD_RECOVERY**
   - Modificar `handleAuthChange` (linhas 36-62)
   - Adicionar case para evento `PASSWORD_RECOVERY`
   - Redirecionar para `/auth?mode=reset` quando evento disparar

```typescript
// Em handleAuthChange (linha 36-62)
const handleAuthChange = useCallback((event: AuthChangeEvent, newSession: Session | null) => {
  logger.debug('Auth state change', { event });

  if (event === 'PASSWORD_RECOVERY') {
    // Usuário clicou no link de reset e token é válido
    // Redirecionar para formulário de nova senha
    window.location.href = '/auth?mode=reset';
    return;
  }

  // ... resto do código existente ...
}, []);
```

2. **Auth.tsx - Detectar modo de recuperação via query params**
   - Importar `useSearchParams` do react-router-dom
   - Verificar se `mode=reset` está presente nos query params
   - Criar estado `const [isRecoveryMode, setIsRecoveryMode] = useState(false)`
   - Renderizar condicionalmente o ResetPasswordForm

```typescript
// Auth.tsx
import { useSearchParams } from 'react-router-dom';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  useEffect(() => {
    // Verificar se estamos em modo de recuperação
    if (searchParams.get('mode') === 'reset') {
      setIsRecoveryMode(true);
    }
  }, [searchParams]);

  // ... resto do código ...

  // Renderização condicional
  if (isRecoveryMode) {
    return (
      <div className="min-h-screen bg-background pt-20">
        <NewHeader />
        <div className="relative flex min-h-[calc(100vh-5rem)] items-center justify-center p-4 sm:p-6 lg:p-8">
          <ResetPasswordForm onSuccess={() => navigate('/dashboard')} />
        </div>
      </div>
    );
  }

  // Renderização normal (tabs login/cadastro)
  return (...);
};
```

3. **Criar ResetPasswordForm.tsx**
   - Dois inputs: "Nova Senha" e "Confirmar Senha"
   - Validação: mínimo 6 caracteres, senhas devem coincidir
   - Reutilizar `PasswordStrengthIndicator` (já existe em Auth.tsx)
   - Botão "Redefinir Senha"
   - **IMPORTANTE**: Não precisa validar token - Supabase já fez isso
   - Apenas chamar `supabase.auth.updateUser({ password })`

**Código Exemplo - ResetPasswordForm.tsx:**
```typescript
import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ExcelIcon } from '@/components/ExcelIcon';

interface ResetPasswordFormProps {
  onSuccess: () => void;
}

export const ResetPasswordForm = ({ onSuccess }: ResetPasswordFormProps) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter no mínimo 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Senhas não coincidem',
        description: 'As senhas digitadas são diferentes.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({
        title: 'Erro ao redefinir senha',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Senha redefinida!',
        description: 'Sua senha foi atualizada com sucesso.',
      });
      // Delay para mostrar toast antes de redirecionar
      setTimeout(() => onSuccess(), 1500);
    }
  };

  return (
    <Card className="w-full max-w-md border-border/50 shadow-soft-lg bg-background/95 backdrop-blur-sm relative">
      <CardHeader className="space-y-3 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mx-auto">
          <ExcelIcon className="w-10 h-10 text-primary" />
        </div>
        <CardTitle className="text-2xl">Redefinir Senha</CardTitle>
        <CardDescription className="text-base">
          Digite sua nova senha abaixo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-sm font-medium">
              Nova Senha
            </Label>
            <Input
              id="new-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11"
            />
            <PasswordStrengthIndicator password={password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-sm font-medium">
              Confirmar Senha
            </Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="h-11"
            />
          </div>

          <Button type="submit" className="w-full h-11 shadow-soft" disabled={loading}>
            {loading ? (
              <>Redefinindo...</>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Redefinir Senha
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
```

---

## Resumo das Alterações

### Arquivos Novos:
1. [src/components/ResetPasswordForm.tsx](src/components/ResetPasswordForm.tsx) - Formulário de redefinição de senha
2. [src/hooks/useSubscriptionManagement.tsx](src/hooks/useSubscriptionManagement.tsx) - Hook compartilhado para gerenciar assinatura
3. [supabase/migrations/[timestamp]_create_missing_subscription_rpc.sql](supabase/migrations/) - RPC function para criar subscriptions faltantes

### Arquivos Modificados:

1. [src/hooks/useSubscription.tsx](src/hooks/useSubscription.tsx)
   - Adicionar recuperação automática de subscription faltante
   - Chamar RPC `create_missing_subscription` quando subscription não existir
   - Adicionar logging para rastrear ocorrências

2. [src/hooks/useAuth.tsx](src/hooks/useAuth.tsx)
   - Adicionar handler para evento `PASSWORD_RECOVERY` em `handleAuthChange`
   - Redirecionar para `/auth?mode=reset` quando evento disparar

3. [src/pages/Account.tsx](src/pages/Account.tsx)
   - Importar `useSubscriptionManagement`
   - Adicionar botões de gerenciamento condicional (Gerenciar/Upgrade)
   - Melhorar estado de retry com loading
   - Adicionar imports: `Settings`, `Crown` de lucide-react

4. [src/pages/Auth.tsx](src/pages/Auth.tsx)
   - Importar `useSearchParams` do react-router-dom
   - Detectar modo de recuperação via query param `mode=reset`
   - Renderização condicional do ResetPasswordForm quando em recovery mode
   - Manter tabs login/cadastro quando não em recovery

5. [src/pages/Plans.tsx](src/pages/Plans.tsx)
   - Substituir `handleManageSubscription` por `useSubscriptionManagement` hook
   - Atualizar botão "Gerenciar Assinatura" para usar `openCustomerPortal`

### Imports Adicionados:

**Account.tsx:**
```typescript
import { Settings, Crown } from 'lucide-react';
import { useSubscriptionManagement } from '@/hooks/useSubscriptionManagement';
```

**Auth.tsx:**
```typescript
import { useSearchParams } from 'react-router-dom';
import { ResetPasswordForm } from '@/components/ResetPasswordForm';
```

**Plans.tsx:**
```typescript
import { useSubscriptionManagement } from '@/hooks/useSubscriptionManagement';
```

**useAuth.tsx:**
```typescript
// Sem novos imports - apenas modificar handleAuthChange
```

---

## Testes Necessários

### Teste 1: Subscription Display
1. Login com usuário existente
2. Verificar se plano atual é exibido corretamente
3. Se houver erro, clicar em "Criar Assinatura"
4. Verificar se assinatura é criada e exibida

### Teste 2: Password Reset Flow
1. Ir para página Account
2. Clicar em "Enviar Email para Redefinir Senha"
3. Verificar recebimento de email
4. Clicar no link do email
5. Verificar redirecionamento para formulário de nova senha
6. Digitar e confirmar nova senha
7. Verificar redirecionamento para dashboard
8. Tentar login com nova senha

### Teste 3: Subscription Management
1. Login com usuário de plano pago
2. Ir para página Account
3. Verificar botão "Gerenciar Assinatura" visível
4. Clicar e verificar abertura do portal Stripe em nova aba
5. Para plano professional, verificar botão upgrade para premium

### Teste 4: Free Plan Upgrade Flow
1. Login com usuário free
2. Verificar card de upgrade visível
3. Clicar em "Ver Planos Disponíveis"
4. Verificar redirecionamento para `/plans`

---

## Ordem de Implementação Recomendada

Para minimizar riscos e garantir que cada parte funcione independentemente:

1. **Primeiro: RPC Function e Subscription Recovery**
   - Criar migration com RPC function
   - Deploy da migration no Supabase
   - Modificar useSubscription.tsx
   - Testar criação de subscription faltante

2. **Segundo: Hook Compartilhado de Subscription Management**
   - Criar useSubscriptionManagement.tsx
   - Refatorar Plans.tsx para usar o hook
   - Testar abertura do portal Stripe
   - Adicionar botões em Account.tsx

3. **Terceiro: Password Reset Flow**
   - Criar ResetPasswordForm.tsx
   - Modificar useAuth.tsx para handler PASSWORD_RECOVERY
   - Modificar Auth.tsx para renderização condicional
   - Testar fluxo completo de reset

---

## Riscos e Considerações

### 1. Supabase RLS e Permissions
- **RLS Policies**: RPC function usa `SECURITY DEFINER` para contornar RLS (seguro)
- **Verificação**: Testar se usuário consegue inserir subscription via RPC
- **Mitigação**: RPC já usa padrão seguro do Supabase (mesmo de `handle_new_user`)

### 2. Password Reset Email Configuration
- **Email Template**: Verificar template no Supabase Dashboard → Auth → Email Templates
- **Redirect URL**: Confirmar que `redirectTo` aceita `vbablocker.vercel.app`
- **Production**: Adicionar domínio à whitelist de redirect URLs no Supabase

### 3. Stripe Portal Integration
- **Function Deploy**: Verificar se `customer-portal` está deployada no Supabase
- **Stripe Config**: Confirmar STRIPE_SECRET_KEY em variáveis de ambiente
- **Return URL**: Portal redireciona para `/plans` (já configurado)

### 4. Auth State Management
- **PASSWORD_RECOVERY Event**: Supabase dispara automaticamente quando token válido
- **Session Sync**: `onAuthStateChange` sincroniza entre tabs
- **Token Validation**: Supabase valida token antes de disparar evento (seguro)

### 5. Migration Deployment
- **Local Dev**: Aplicar migration com `supabase migration up`
- **Production**: Deployment automático via Supabase CLI ou dashboard
- **Rollback**: Criar migration reversa se necessário

### 6. Loading States e UX
- **Race Conditions**: Hook de subscription tem lock ref para evitar duplicatas
- **Retry Logic**: Account.tsx adiciona estado `retrying` separado
- **Toast Timing**: Delay de 1.5s antes de redirect para mostrar toast

### 7. Edge Cases
- **Token Expirado**: Supabase não dispara PASSWORD_RECOVERY, usuário vê login normal
- **Token Já Usado**: Mesmo comportamento - one-time use enforcement
- **Multiple Tabs**: Session sync via localStorage funciona automaticamente
- **Subscription Duplicada**: `ON CONFLICT DO NOTHING` previne duplicatas

---

## Benefícios Esperados

✅ Usuários verão plano atual claramente exibido
✅ Fluxo de reset de senha funcionará completamente
✅ Usuários poderão cancelar assinatura pela página Account
✅ Upgrade path ficará mais claro e acessível
✅ Melhor UX com menos cliques para tarefas comuns
✅ Menos tickets de suporte sobre "não consigo ver meu plano"
✅ Menos frustração com reset de senha quebrado
