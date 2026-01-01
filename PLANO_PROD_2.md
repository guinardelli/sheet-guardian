# PLANO DE CORREÇÃO: Erro "Não foi possível validar o processamento agora"

**Data:** 2026-01-01
**Prioridade:** CRÍTICA
**Status:** Aguardando implementação

---

## 1. DIAGNÓSTICO

### 1.1 Problema
Ao tentar processar qualquer planilha .xlsm, o usuário recebe o erro:
> "Não foi possível validar o processamento agora."

### 1.2 Causa Raiz
A tabela `processing_tokens` **NÃO EXISTE** no banco de dados Supabase.

A migration `supabase/migrations/20260120120000_add_processing_tokens.sql` existe no código mas **nunca foi aplicada** ao banco de produção.

### 1.3 Evidências

**Logs do Edge Function (últimas 24h):**
```
POST | 500 | validate-processing (277ms)
POST | 500 | validate-processing (292ms)
POST | 500 | validate-processing (281ms)
```

**Migrations aplicadas (última: 20260115):**
- 20251208120034, 20251210, 20251211, 20251222120000, 20251222130000
- 20251224, 20251229, 20251230, 20251231110928, 20251231124046
- 20260115 ← ÚLTIMA
- ~~20260120120000_add_processing_tokens~~ ← **NÃO APLICADA**

**Tabelas existentes:**
- profiles, subscriptions, auth_attempts, error_logs, stripe_webhook_events
- ~~processing_tokens~~ ← **NÃO EXISTE**

### 1.4 Fluxo do Erro
```
1. Usuario clica "Processar"
2. Dashboard.handleProcess() é chamado
3. requestProcessingToken(file) invoca Edge Function
4. validate-processing tenta INSERT na tabela processing_tokens
5. Tabela não existe → PostgreSQL retorna erro
6. Edge Function retorna HTTP 500
7. Cliente recebe { error: "Internal server error" }
8. useSubscription retorna: "Não foi possível validar o processamento agora."
```

---

## 2. SOLUÇÃO

### 2.1 Aplicar Migration Pendente

**Usar Supabase MCP:**
```
mcp__supabase__apply_migration(
  name: "add_processing_tokens_and_rls",
  query: "<SQL abaixo>"
)
```

**SQL Completo:**
```sql
-- 1. Criar tabela processing_tokens
CREATE TABLE IF NOT EXISTS public.processing_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS processing_tokens_user_id_idx
  ON public.processing_tokens (user_id);

CREATE INDEX IF NOT EXISTS processing_tokens_expires_at_idx
  ON public.processing_tokens (expires_at);

CREATE INDEX IF NOT EXISTS processing_tokens_token_idx
  ON public.processing_tokens (token);

-- 3. Habilitar RLS
ALTER TABLE public.processing_tokens ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS (Edge Functions usam service_role que bypassa RLS)
-- Usuários autenticados só podem ver seus próprios tokens
CREATE POLICY "Users can view own tokens"
  ON public.processing_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role (Edge Functions) tem acesso total
CREATE POLICY "Service role full access"
  ON public.processing_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### 2.2 Verificar Tabela Criada

```
mcp__supabase__list_tables()
```

Deve incluir `processing_tokens` na lista.

### 2.3 Testar Edge Function

```
mcp__supabase__get_logs(service: "edge-function")
```

Verificar que `validate-processing` retorna HTTP 200 após a correção.

---

## 3. STRESS TEST

### 3.1 Arquivos de Teste
Localização: `arq-test/`

| # | Arquivo | Tamanho | Teste |
|---|---------|---------|-------|
| 1 | 60-PRE-RENDIMIENTO-DE-GUYON-V1.5.xlsm | 51 KB | Arquivo pequeno |
| 2 | 70-PRE-TRANSPORTE-E-ICAMENTO-V1.7.xlsm | 149 KB | Arquivo médio |
| 3 | 10-PRE-CONSOLE-V2.3.xlsm | 565 KB | Arquivo grande |
| 4 | Viga-Pre-fabricada.xls | 251 KB | Formato inválido (deve rejeitar) |

### 3.2 Procedimento de Teste

1. **Login no aplicativo** com usuário de teste
2. **Para cada arquivo .xlsm:**
   - Fazer upload
   - Clicar em "Processar"
   - Verificar se processamento completa sem erro
   - Confirmar download do arquivo modificado
3. **Para o arquivo .xls:**
   - Fazer upload
   - Verificar que é rejeitado com mensagem apropriada

### 3.3 Validação de Sucesso

- [ ] Tabela `processing_tokens` existe no banco
- [ ] Edge Function `validate-processing` retorna HTTP 200
- [ ] Processamento dos 3 arquivos .xlsm funciona
- [ ] Arquivo .xls é corretamente rejeitado
- [ ] Tokens são criados e consumidos no banco

---

## 4. ARQUIVOS RELEVANTES

### Backend (Supabase)
| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/20260120120000_add_processing_tokens.sql` | Migration original (incompleta) |
| `supabase/functions/validate-processing/index.ts` | Edge Function que usa a tabela |
| `supabase/functions/cleanup-tokens/index.ts` | Job para limpar tokens expirados |

### Frontend
| Arquivo | Linha | Descrição |
|---------|-------|-----------|
| `src/hooks/useSubscription.tsx` | 367-403 | `requestProcessingToken()` |
| `src/hooks/useSubscription.tsx` | 469-516 | `incrementUsage()` |
| `src/pages/Dashboard.tsx` | 210-235 | Chamada de validação |
| `src/lib/fetch-with-retry.ts` | 1-23 | Retry logic para fetch |

---

## 5. CHECKLIST DE IMPLEMENTAÇÃO

```
[ ] 1. Aplicar migration via Supabase MCP
[ ] 2. Verificar tabela criada (list_tables)
[ ] 3. Verificar logs do Edge Function (get_logs)
[ ] 4. Testar arquivo pequeno (60-PRE-RENDIMIENTO)
[ ] 5. Testar arquivo médio (70-PRE-TRANSPORTE)
[ ] 6. Testar arquivo grande (10-PRE-CONSOLE)
[ ] 7. Testar rejeição de .xls (Viga-Pre-fabricada)
[ ] 8. Executar testes unitários (npm test -- --run)
[ ] 9. Verificar tokens no banco após testes
```

---

## 6. COMANDOS MCP

### Aplicar Migration
```javascript
mcp__supabase__apply_migration({
  name: "add_processing_tokens_complete",
  query: `
    CREATE TABLE IF NOT EXISTS public.processing_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      token text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS processing_tokens_user_id_idx ON public.processing_tokens (user_id);
    CREATE INDEX IF NOT EXISTS processing_tokens_expires_at_idx ON public.processing_tokens (expires_at);
    CREATE INDEX IF NOT EXISTS processing_tokens_token_idx ON public.processing_tokens (token);

    ALTER TABLE public.processing_tokens ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view own tokens" ON public.processing_tokens
      FOR SELECT TO authenticated USING (auth.uid() = user_id);

    CREATE POLICY "Service role full access" ON public.processing_tokens
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  `
})
```

### Verificar Tabelas
```javascript
mcp__supabase__list_tables({ schemas: ["public"] })
```

### Verificar Logs
```javascript
mcp__supabase__get_logs({ service: "edge-function" })
```

### Consultar Tokens Criados
```javascript
mcp__supabase__execute_sql({
  query: "SELECT * FROM public.processing_tokens ORDER BY created_at DESC LIMIT 10"
})
```

---

## 7. ROLLBACK (se necessário)

```sql
-- Remover políticas
DROP POLICY IF EXISTS "Users can view own tokens" ON public.processing_tokens;
DROP POLICY IF EXISTS "Service role full access" ON public.processing_tokens;

-- Remover tabela
DROP TABLE IF EXISTS public.processing_tokens CASCADE;
```

---

**Última atualização:** 2026-01-01
