# MODIFICACAO_01: Correção da Sincronização de Assinatura Stripe

## Contexto do Problema

Após completar o checkout no Stripe e ser redirecionado para `/plans?success=true`:
1. Aparece mensagem "Pagamento realizado! Sua assinatura está sendo processada..."
2. Logo em seguida aparece "Erro ao verificar assinatura. Clique em verificar assinatura..."
3. O botão "Verificar Assinatura" **NÃO aparece** para o usuário

---

## Causas Raiz Identificadas

### Causa 1: Race Condition (Condição de Corrida)
**Arquivo:** `src/pages/Plans.tsx:145-162`

O problema ocorre porque `checkStripeSubscription()` é chamado **imediatamente** após o redirect, mas o Stripe leva 1-5 segundos para processar completamente a assinatura.

```typescript
// Código atual problemático:
useEffect(() => {
  const success = searchParams.get('success');
  if (success === 'true') {
    toast({ title: 'Pagamento realizado!' });
    checkStripeSubscription();  // Chamado IMEDIATAMENTE - muito cedo!
  }
}, [searchParams, checkStripeSubscription, toast]);
```

### Causa 2: Sem Mecanismo de Retry
A verificação é feita apenas **UMA vez**. Se falhar (porque o Stripe ainda está processando), o usuário fica preso sem opção de tentar novamente automaticamente.

### Causa 3: `refetch()` Não É Chamado no Erro
**Arquivo:** `src/pages/Plans.tsx:118-130`

```typescript
// Código atual:
if (data?.subscribed) {
  await refetch();  // Chamado apenas no SUCESSO
} else {
  setSyncStatus('error');  // NÃO chama refetch()!
  setSyncError('Assinatura nao encontrada...');
}
```

Quando a verificação falha, `refetch()` não é chamado. Isso significa que o estado local da assinatura não é atualizado com `stripe_customer_id`, fazendo com que o botão "Verificar Assinatura" não apareça.

---

## Modificações Necessárias

### Arquivo: `src/pages/Plans.tsx`

---

### Modificação 1: Adicionar Estados para Controle de Retry

**Localização:** Linha ~90-92 (após os estados existentes)

**Adicionar:**
```typescript
const [processing, setProcessing] = useState(false);
const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'error'>('idle');
const [syncError, setSyncError] = useState<string | null>(null);
// ADICIONAR ESTES DOIS NOVOS ESTADOS:
const [retryAttempt, setRetryAttempt] = useState(0);
const [isAutoVerifying, setIsAutoVerifying] = useState(false);
```

---

### Modificação 2: Modificar Função `checkStripeSubscription`

**Localização:** Linhas 94-136

**Substituir a função inteira por:**

```typescript
const checkStripeSubscription = useCallback(async (): Promise<boolean> => {
  if (!session?.access_token) return false;

  setSyncStatus('loading');
  setSyncError(null);

  try {
    const { data, error } = await supabase.functions.invoke('check-subscription', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    // IMPORTANTE: Sempre chamar refetch() para atualizar stripe_customer_id
    // Isso garante que o botão "Verificar Assinatura" apareça se houver erro
    await refetch();

    if (error) {
      logger.error('Erro ao verificar assinatura', error);
      setSyncError('Não foi possível verificar sua assinatura. Clique em "Verificar" para tentar novamente.');
      setSyncStatus('error');
      return false;
    }

    if (data?.subscribed) {
      setSyncStatus('idle');
      setSyncError(null);
      toast({
        title: 'Assinatura ativada!',
        description: `Você agora é assinante do plano ${
          PLAN_INFO[data.plan as keyof typeof PLAN_INFO]?.name || data.plan
        }.`,
      });
      return true;
    } else {
      setSyncStatus('error');
      setSyncError('Aguardando confirmação do pagamento. Isso pode levar alguns segundos...');
      return false;
    }
  } catch (error) {
    logger.error('Error checking subscription', error);
    setSyncStatus('error');
    setSyncError('Erro ao conectar com o servidor. Tente novamente.');
    // IMPORTANTE: Também chamar refetch() em caso de erro de conexão
    await refetch();
    return false;
  }
}, [session?.access_token, refetch, toast]);
```

---

### Modificação 3: Substituir o useEffect de Detecção de Sucesso

**Localização:** Linhas 145-162

**Substituir o useEffect inteiro por:**

```typescript
useEffect(() => {
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  if (success === 'true' && !isAutoVerifying) {
    setIsAutoVerifying(true);
    toast({
      title: 'Pagamento realizado!',
      description: 'Sua assinatura está sendo processada. Aguarde alguns instantes...',
    });

    // Função de verificação com retry e backoff
    const verifyWithRetry = async () => {
      const delays = [3000, 5000, 8000, 12000]; // 3s, 5s, 8s, 12s

      for (let i = 0; i < delays.length; i++) {
        setRetryAttempt(i + 1);

        // Aguardar o delay antes de verificar
        await new Promise(resolve => setTimeout(resolve, delays[i]));

        // Tentar verificar a assinatura
        const success = await checkStripeSubscription();

        if (success) {
          setIsAutoVerifying(false);
          setRetryAttempt(0);
          return; // Sucesso! Sair do loop
        }
      }

      // Se chegou aqui, todas as tentativas falharam
      setIsAutoVerifying(false);
      setRetryAttempt(0);
      setSyncStatus('error');
      setSyncError('Não foi possível confirmar sua assinatura automaticamente. Use o botão abaixo para verificar manualmente.');
      toast({
        title: 'Verificação automática falhou',
        description: 'Clique em "Verificar Assinatura" para tentar novamente.',
        variant: 'destructive',
      });
    };

    verifyWithRetry();
  } else if (canceled === 'true') {
    toast({
      title: 'Pagamento cancelado',
      description: 'O pagamento foi cancelado. Você pode tentar novamente quando quiser.',
      variant: 'destructive',
    });
  }
}, [searchParams, checkStripeSubscription, toast, isAutoVerifying]);
```

---

### Modificação 4: Adicionar Componente de Progresso Durante Verificação

**Localização:** Após a linha ~415 (após o Alert de syncError)

**Adicionar antes do `{hasActiveSubscription && (`:**

```typescript
{/* Indicador de progresso durante verificação automática */}
{isAutoVerifying && (
  <Alert className="mb-4">
    <Loader2 className="h-4 w-4 animate-spin" />
    <AlertDescription>
      Verificando assinatura com o Stripe... (tentativa {retryAttempt}/4)
    </AlertDescription>
  </Alert>
)}
```

---

### Modificação 5: Melhorar o Alert de Erro com Botão Integrado

**Localização:** Linhas 408-413

**Substituir:**
```typescript
{syncError && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>{syncError}</AlertDescription>
  </Alert>
)}
```

**Por:**
```typescript
{syncError && !isAutoVerifying && (
  <Alert variant="destructive" className="mb-4">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <span>{syncError}</span>
      <Button
        size="sm"
        variant="outline"
        onClick={checkStripeSubscription}
        disabled={syncStatus === 'loading'}
        className="shrink-0"
      >
        {syncStatus === 'loading' ? (
          <>
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            Verificando...
          </>
        ) : (
          'Verificar Assinatura'
        )}
      </Button>
    </AlertDescription>
  </Alert>
)}
```

---

## Resumo das Alterações

| # | Modificação | Linha Aproximada |
|---|-------------|------------------|
| 1 | Adicionar estados `retryAttempt` e `isAutoVerifying` | ~90-92 |
| 2 | Modificar `checkStripeSubscription` para retornar boolean e sempre chamar refetch | 94-136 |
| 3 | Substituir useEffect de sucesso com lógica de retry | 145-162 |
| 4 | Adicionar Alert de progresso durante verificação | ~415 |
| 5 | Melhorar Alert de erro com botão integrado | 408-413 |

---

## Fluxo Esperado Após Correção

### Cenário de Sucesso (Normal):
```
1. Usuário completa checkout no Stripe
2. Redirect para /plans?success=true
3. Toast: "Pagamento realizado!"
4. Alert: "Verificando assinatura... (tentativa 1/4)"
5. Aguarda 3 segundos
6. Primeira verificação → Stripe processou → sucesso!
7. Toast: "Assinatura ativada! Plano Professional"
8. UI atualiza com o novo plano
```

### Cenário de Stripe Lento:
```
1-4. Mesmo que acima
5. Aguarda 3 segundos
6. Primeira verificação → falha (Stripe ainda processando)
7. Alert: "Verificando assinatura... (tentativa 2/4)"
8. Aguarda 5 segundos
9. Segunda verificação → sucesso!
10. Toast: "Assinatura ativada!"
```

### Cenário de Falha Total:
```
1-4. Mesmo que acima
5-12. Todas as 4 tentativas falham
13. Alert vermelho: "Não foi possível confirmar..." + Botão "Verificar Assinatura"
14. Usuário pode clicar no botão para verificar manualmente
```

---

## Imports Necessários

Verificar que estes imports existem no início do arquivo:

```typescript
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
```

---

## Testes Recomendados

1. **Teste básico:** Fazer checkout e verificar se a verificação automática funciona
2. **Teste de retry:** Desconectar temporariamente da rede após redirect para forçar retries
3. **Teste do botão manual:** Verificar que o botão aparece após todas as tentativas falharem
4. **Teste de UX:** Verificar que os textos e feedback visual estão corretos

---

## Notas Importantes

- O webhook do Stripe continua funcionando normalmente como fallback
- Se o webhook processar antes da verificação manual, a próxima verificação vai encontrar a assinatura ativa
- Os delays (3s, 5s, 8s, 12s) foram escolhidos para dar tempo ao Stripe sem fazer o usuário esperar muito
- Total máximo de espera automática: ~28 segundos
