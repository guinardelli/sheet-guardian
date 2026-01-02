# INSTRUCAO_01 - Correções de Segurança AppSec

## Objetivo
Corrigir duas vulnerabilidades de segurança identificadas nas Supabase Edge Functions.

---

## TAREFA 1: Corrigir Retorno de Autenticação em check-subscription

### Arquivo
`supabase/functions/check-subscription/index.ts`

### Problema
Quando a autenticação falha, o código lança uma exceção que resulta em HTTP 500 (erro de servidor) em vez de HTTP 401 (não autorizado).

### Localização
Linhas 48-51

### Código Atual (REMOVER)
```typescript
    // AUTENTICACAO COM RLS
    const authResult = await authenticateUser(req.headers.get("Authorization"));
    if (!authResult.success) {
      throw new Error(authResult.error);
    }
```

### Código Corrigido (SUBSTITUIR POR)
```typescript
    // AUTENTICACAO COM RLS
    const authResult = await authenticateUser(req.headers.get("Authorization"));
    if (!authResult.success) {
      const body: SubscriptionResponse = {
        requestId,
        subscribed: false,
        error: authResult.error,
      };
      return new Response(JSON.stringify(body), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: authResult.status,
      });
    }
```

### Resultado Esperado
- Requisições sem autenticação devem retornar HTTP 401
- O corpo da resposta deve conter `requestId` e `error`

---

## TAREFA 2: Implementar Comparação Timing-Safe para Admin Token

### Arquivo
`supabase/functions/_shared/auth.ts`

### Problema
A função `validateAdminToken` usa comparação simples de strings (`===`) que é vulnerável a timing attacks.

### Localização
Linhas 56-65

### Código Atual (REMOVER)
```typescript
/**
 * Verifica se o request possui um token de administrador valido.
 * Usado para endpoints de manutencao (cron jobs, health checks).
 */
export const validateAdminToken = (
  authHeader: string | null,
  expectedSecret: string
): boolean => {
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.replace("Bearer ", "");
  return token === expectedSecret && token.length > 0;
};
```

### Código Corrigido (SUBSTITUIR POR)
```typescript
/**
 * Verifica se o request possui um token de administrador valido.
 * Usado para endpoints de manutencao (cron jobs, health checks).
 * Usa comparacao constant-time para evitar timing attacks.
 */
export const validateAdminToken = (
  authHeader: string | null,
  expectedSecret: string
): boolean => {
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.replace("Bearer ", "");

  if (token.length === 0 || expectedSecret.length === 0) {
    return false;
  }

  // Constant-time comparison para evitar timing attacks
  const encoder = new TextEncoder();
  const tokenBytes = encoder.encode(token);
  const secretBytes = encoder.encode(expectedSecret);

  if (tokenBytes.length !== secretBytes.length) {
    return false;
  }

  // Comparacao byte-a-byte em tempo constante
  let result = 0;
  for (let i = 0; i < tokenBytes.length; i++) {
    result |= tokenBytes[i] ^ secretBytes[i];
  }
  return result === 0;
};
```

### Resultado Esperado
- A função continua validando tokens corretamente
- Atacantes não podem inferir o secret via análise de timing

---

## Verificação Pós-Implementação

Execute os seguintes testes:

```bash
# Testar check-subscription sem auth (DEVE retornar 401)
curl -X GET https://[PROJECT_ID].supabase.co/functions/v1/check-subscription

# Testar cleanup-tokens sem auth (DEVE retornar 401)
curl -X POST https://[PROJECT_ID].supabase.co/functions/v1/cleanup-tokens

# Testar health-check sem auth (DEVE retornar 401)
curl -X GET https://[PROJECT_ID].supabase.co/functions/v1/health-check
```

### Resposta Esperada para TODOS
```json
{
  "error": "Missing or invalid Authorization header",
  "requestId": "uuid-gerado"
}
```
Com status HTTP: **401**

---

## Resumo

| # | Arquivo | Alteração |
|---|---------|-----------|
| 1 | `supabase/functions/check-subscription/index.ts` | Retornar 401 em vez de 500 |
| 2 | `supabase/functions/_shared/auth.ts` | Usar comparação timing-safe |

**Padrão Enterprise**: Fail closed - todas as falhas de autenticação devem resultar em negação de acesso explícita (4xx).
