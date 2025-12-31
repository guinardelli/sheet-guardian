# Analise Completa: PLANO_QA.md vs Codigo Real

**Data**: 31/12/2025
**Autor**: Claude Code (Opus 4.5)
**Versao**: 1.0

## Resumo Executivo

Realizei uma analise profunda do PLANO_QA.md comparando cada item com o codigo real do projeto Sheet Guardian. O plano e **bem estruturado e abrangente**, mas identifico **3 lacunas criticas**, **4 itens que precisam correcao**, e **6 melhorias adicionais** a serem incorporadas.

---

## PARTE 1: Itens CONFIRMADOS (Implementados Corretamente)

| Item do Plano | Evidencia no Codigo | Status |
|---------------|---------------------|--------|
| RLS em profiles/subscriptions | `supabase/migrations/20251208120034...sql` linhas 26-47 | OK |
| Webhook Stripe com assinatura | `stripe-webhook/index.ts:107-123` usa `stripe.webhooks.constructEvent()` | OK |
| Rate Limiting autenticacao | `useAuth.tsx:120-141` + `20251210_add_rate_limiting.sql` - 5 tentativas/15min | OK |
| Logging em Edge Functions | `supabase/functions/_shared/logger.ts` - logger com escopo | OK |
| .env nao commitado | `.gitignore` linha 17 inclui `.env` | OK |
| CORS whitelist | `check-subscription/index.ts:6-22` - origem verificada | OK |
| Idempotencia Webhook | `stripe-webhook/index.ts:131-167` - tabela `stripe_webhook_events` | OK |
| Anonimizacao PII | `error-tracker.ts` - nao loga emails/passwords | OK |

---

## PARTE 2: Lacunas CRITICAS Nao Mencionadas no Plano

### P0-1: Validacao de Assinatura NAO OCORRE no Servidor Durante Processamento

**Risco**: BYPASS DE ASSINATURA
**Localizacao**: `src/hooks/useSubscription.tsx:306-368` (client-side only)

**Problema**: A funcao `canProcessSheet()` valida limites apenas no cliente. Um usuario pode:
1. Modificar o JavaScript no browser
2. Chamar o processamento diretamente
3. Ignorar limites de uso

**Mitigacao Recomendada**:
```
Criar Edge Function: supabase/functions/validate-processing/index.ts
- Receber user_id + file metadata
- Validar subscription status + limites
- Retornar token de processamento com TTL curto
- Client so processa com token valido
```

**Arquivos a modificar**:
- `supabase/functions/validate-processing/index.ts` (novo)
- `src/lib/excel-vba-modifier.ts:104-240` (adicionar validacao)
- `src/hooks/useSubscription.tsx` (chamar Edge Function)

---

### P0-2: Validacao de MIME Type/Magic Bytes NAO Implementada

**Risco**: UPLOAD DE MALWARE
**Localizacao**: `src/components/FileDropzone.tsx:44-78`

**Problema**: Validacao atual:
- Extensao `.xlsm` - SIM (linha 46-50)
- Tamanho - SIM (linha 62-67)
- MIME type - NAO (constantes existem mas NAO SAO USADAS)
- Magic bytes (PK\x03\x04) - NAO

**Evidencia**: `src/lib/constants.ts:17-22` define `ALLOWED_MIME_TYPES` mas grep nao encontra uso.

**Mitigacao Recomendada**:
```typescript
// Em FileDropzone.tsx ou excel-vba-modifier.ts
const validateMagicBytes = (buffer: ArrayBuffer): boolean => {
  const view = new Uint8Array(buffer);
  // ZIP signature: PK\x03\x04
  return view[0] === 0x50 && view[1] === 0x4B &&
         view[2] === 0x03 && view[3] === 0x04;
};
```

**Arquivos a modificar**:
- `src/components/FileDropzone.tsx:44-78`
- `src/lib/excel-vba-modifier.ts:119-140`

---

### P0-3: React Error Boundaries NAO Implementado

**Risco**: CRASH DE UI SEM FALLBACK
**Localizacao**: `src/App.tsx`

**Problema**: Grep por "ErrorBoundary" retorna 0 matches. Erros de renderizacao React causam tela branca.

**Mitigacao Recomendada**:
```
Criar: src/components/ErrorBoundary.tsx
- Class component com componentDidCatch
- UI de fallback amigavel
- Botao "Recarregar pagina"
- Integrar com error-tracker.ts
```

**Arquivos a modificar**:
- `src/components/ErrorBoundary.tsx` (novo)
- `src/App.tsx` (wrap routes com ErrorBoundary)

---

## PARTE 3: Itens do Plano que Precisam CORRECAO

### 1. Conflito Netlify vs Vercel

**Status no Plano**: Identificado corretamente
**Verificacao**: Ambos existem - `netlify.toml` e `vercel.json`
**Recomendacao**: Vercel e a plataforma primaria (CSP inclui Stripe, HSTS configurado)

**Acao**: Remover `netlify.toml` ou documentar que e apenas backup

---

### 2. Inconsistencia de Senha (NAO MENCIONADO NO PLANO)

**Arquivos com conflito**:
- `src/lib/constants.ts:29` - `PASSWORD_MIN_LENGTH = 8`
- `src/pages/Auth.tsx:39` - `.min(6, { message: ... })`
- `supabase/config.toml:169` - `minimum_password_length = 6`

**Acao**: Alinhar TODOS para 8 caracteres

---

### 3. npm audit Ausente no CI (NAO MENCIONADO NO PLANO)

**Arquivo**: `.github/workflows/ci.yml`
**Problema**: Nenhum step de `npm audit`

**Acao**: Adicionar job de security audit:
```yaml
- name: Security Audit
  run: npm audit --audit-level=high
```

---

### 4. SAST Ausente no CI (MENCIONADO MAS NAO DETALHADO)

**Acao**: Adicionar CodeQL ou SonarQube action no workflow

---

## PARTE 4: Melhorias Adicionais ao Plano

| Prioridade | Item | Descricao |
|------------|------|-----------|
| P1 | ProtectedRoute Component | Criar wrapper para rotas autenticadas (evita flash de conteudo) |
| P1 | Documentar Restore de Backup | `backup.sh` existe mas nao ha procedimento de restore |
| P2 | Test Coverage Metrics | CI roda testes mas nao reporta cobertura |
| P2 | Exponential Backoff | Rate limit usa tempo fixo, considerar backoff progressivo |
| P2 | Supabase Storage Cleanup | Verificar se ha policy de retencao de arquivos |
| P3 | Browser Compatibility Matrix | Adicionar testes em Safari/Firefox ao Playwright |

---

## PARTE 5: Perguntas Bloqueantes - VALIDACAO

O plano lista 4 perguntas bloqueantes. Minha analise:

| Pergunta | Resposta Baseada no Codigo |
|----------|---------------------------|
| **Hospedagem** | Vercel e primario (CSP com Stripe, HSTS). Remover netlify.toml. |
| **Logica de Desbloqueio** | Ocorre no browser (`excel-vba-modifier.ts`). Codigo exposto - risco de IP aceito. |
| **Persistencia de Arquivos** | Processamento em memoria (RAM do browser). Nao ha upload para Storage. |
| **Variaveis de Producao** | `.env` gitignored. Variaveis em painel Supabase/Vercel. Acesso: verificar com PO. |

---

## PARTE 6: Matriz de Riscos - ADICOES

Adicionar ao Top 15 de riscos:

| Risco | Impacto | Prob. | Mitigacao |
|-------|---------|-------|-----------|
| Bypass de Limites via Console | Alto (Financeiro) | Media | Server-side validation |
| Crash React sem Fallback | Medio (UX) | Alta | Error Boundaries |
| Arquivo Malicioso Aceito | Critico | Baixa | Magic byte validation |
| Senha Fraca Aceita | Medio (Seguranca) | Media | Alinhar min=8 |

---

## PARTE 7: Plano de Acao Priorizado

### Antes do Deploy (P0)

1. [ ] Criar Edge Function `validate-processing` para enforcement server-side
2. [ ] Implementar validacao de magic bytes (PK signature)
3. [ ] Adicionar React ErrorBoundary em App.tsx
4. [ ] Corrigir inconsistencia de senha (min=8 em Auth.tsx e config.toml)
5. [ ] Adicionar `npm audit --audit-level=high` no CI

### Primeira Semana Pos-Deploy (P1)

6. [ ] Remover netlify.toml (Vercel e primario)
7. [ ] Criar componente ProtectedRoute
8. [ ] Documentar procedimento de restore de backup
9. [ ] Adicionar CodeQL/SAST ao CI

### Primeira Sprint Completa (P2)

10. [ ] Implementar test coverage reporting
11. [ ] Adicionar testes E2E em Safari/Firefox
12. [ ] Revisar politicas de retencao de Storage

---

## Arquivos Criticos para Modificacao

```
NOVOS:
- supabase/functions/validate-processing/index.ts
- src/components/ErrorBoundary.tsx

MODIFICAR:
- src/components/FileDropzone.tsx (magic bytes)
- src/lib/excel-vba-modifier.ts (server validation)
- src/pages/Auth.tsx:39 (min=8)
- supabase/config.toml:169 (min=8)
- .github/workflows/ci.yml (npm audit + CodeQL)
- src/App.tsx (wrap com ErrorBoundary)

REMOVER:
- netlify.toml (opcional, confirmar com PO)
```

---

## PARTE 8: Implementacao Edge Function validate-processing

### Arquitetura Proposta

```
Cliente                    Edge Function               Database
   |                           |                          |
   |-- 1. Solicita token ----->|                          |
   |                           |-- 2. Valida JWT -------->|
   |                           |<- 3. Retorna sub data ---|
   |                           |                          |
   |                           |-- 4. Verifica limites    |
   |                           |                          |
   |<- 5. Token + expiry ------|                          |
   |                           |                          |
   |-- 6. Processa arquivo --->| (validacao local)        |
   |                           |                          |
   |-- 7. Incrementa uso ----->|------------------------>|
```

### Codigo da Edge Function

**Arquivo**: `supabase/functions/validate-processing/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://vbablocker.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Buscar subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (subError || !subscription) {
      return new Response(JSON.stringify({ error: 'No subscription found' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verificar limites baseado no plano
    const limits = {
      free: { monthly: 1, weekly: null },
      professional: { monthly: null, weekly: 5 },
      premium: { monthly: null, weekly: null }
    }

    const planLimits = limits[subscription.plan as keyof typeof limits]

    // Verificar limite mensal (free)
    if (planLimits.monthly && subscription.sheets_used_month >= planLimits.monthly) {
      return new Response(JSON.stringify({
        allowed: false,
        reason: 'Limite mensal atingido',
        suggestUpgrade: true
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verificar limite semanal (professional)
    if (planLimits.weekly && subscription.sheets_used_week >= planLimits.weekly) {
      return new Response(JSON.stringify({
        allowed: false,
        reason: 'Limite semanal atingido',
        suggestUpgrade: true
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Gerar token de processamento com TTL de 5 minutos
    const processingToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    return new Response(JSON.stringify({
      allowed: true,
      processingToken,
      expiresAt,
      plan: subscription.plan
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

### Integracao no Cliente

**Arquivo**: `src/hooks/useSubscription.tsx` - adicionar:

```typescript
const requestProcessingToken = async (): Promise<{
  allowed: boolean;
  processingToken?: string;
  reason?: string;
}> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { allowed: false, reason: 'Nao autenticado' };

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-processing`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.json();
};
```

---

## PARTE 9: Testes E2E Expandidos (Playwright)

### Estrutura de Testes Proposta

```
tests/
├── e2e/
│   ├── auth/
│   │   ├── login.spec.ts
│   │   ├── signup.spec.ts
│   │   └── rate-limiting.spec.ts
│   ├── subscription/
│   │   ├── free-plan-limits.spec.ts
│   │   ├── upgrade-flow.spec.ts
│   │   └── webhook-sync.spec.ts
│   ├── processing/
│   │   ├── valid-file.spec.ts
│   │   ├── invalid-file.spec.ts
│   │   └── malicious-file.spec.ts
│   └── fixtures/
│       ├── test-files/
│       │   ├── valid-macro.xlsm
│       │   ├── no-vba.xlsm
│       │   ├── corrupted.xlsm
│       │   └── fake-xlsm.exe.xlsm
│       └── test-users.json
├── playwright.config.ts
└── global-setup.ts
```

### Cenarios de Teste Detalhados

#### 1. Autenticacao (auth/)

**login.spec.ts**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/auth');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'SecurePass123!');
    await page.click('[data-testid="login-button"]');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/auth');
    await page.fill('[data-testid="email"]', 'wrong@example.com');
    await page.fill('[data-testid="password"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');

    await expect(page.locator('[data-testid="error-toast"]')).toContainText('Credenciais invalidas');
  });

  test('should redirect unauthenticated users from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/auth');
  });
});
```

**rate-limiting.spec.ts**
```typescript
test.describe('Rate Limiting', () => {
  test('should block after 5 failed attempts', async ({ page }) => {
    await page.goto('/auth');

    for (let i = 0; i < 6; i++) {
      await page.fill('[data-testid="email"]', 'test@example.com');
      await page.fill('[data-testid="password"]', 'wrongpassword');
      await page.click('[data-testid="login-button"]');
      await page.waitForTimeout(500);
    }

    await expect(page.locator('[data-testid="error-toast"]'))
      .toContainText('Muitas tentativas');
  });
});
```

#### 2. Limites de Assinatura (subscription/)

**free-plan-limits.spec.ts**
```typescript
test.describe('Free Plan Limits', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'free-user@test.com');
  });

  test('should allow first file processing', async ({ page }) => {
    await page.goto('/dashboard');
    await uploadFile(page, 'fixtures/test-files/valid-macro.xlsm');

    await expect(page.locator('[data-testid="processing-log"]')).toBeVisible();
    await expect(page.locator('[data-testid="download-button"]')).toBeVisible();
  });

  test('should block second file in same month', async ({ page }) => {
    await page.goto('/dashboard');
    await uploadFile(page, 'fixtures/test-files/valid-macro.xlsm');

    await expect(page.locator('[data-testid="upgrade-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="upgrade-modal"]'))
      .toContainText('Limite mensal atingido');
  });
});
```

**upgrade-flow.spec.ts**
```typescript
test.describe('Upgrade Flow (Stripe Test Mode)', () => {
  test('should complete checkout for Professional plan', async ({ page }) => {
    await loginAsUser(page, 'free-user@test.com');
    await page.goto('/plans');

    await page.click('[data-testid="plan-professional"] button');
    await page.waitForURL(/checkout\.stripe\.com/);

    await page.fill('[data-testid="cardNumber"]', '4242424242424242');
    await page.fill('[data-testid="cardExpiry"]', '12/30');
    await page.fill('[data-testid="cardCvc"]', '123');
    await page.fill('[data-testid="billingName"]', 'Test User');
    await page.click('[data-testid="submit"]');

    await page.waitForURL('/dashboard?success=true');
    await expect(page.locator('[data-testid="plan-badge"]'))
      .toContainText('Professional');
  });
});
```

#### 3. Processamento de Arquivos (processing/)

**valid-file.spec.ts**
```typescript
test.describe('Valid File Processing', () => {
  test('should process .xlsm with VBA successfully', async ({ page }) => {
    await loginAsUser(page, 'pro-user@test.com');
    await page.goto('/dashboard');

    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles('fixtures/test-files/valid-macro.xlsm');

    await expect(page.locator('[data-testid="processing-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="processing-complete"]'))
      .toBeVisible({ timeout: 30000 });

    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-button"]');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain('_unprotected.xlsm');
  });
});
```

**invalid-file.spec.ts**
```typescript
test.describe('Invalid File Handling', () => {
  test('should reject non-xlsm files', async ({ page }) => {
    await loginAsUser(page, 'pro-user@test.com');
    await page.goto('/dashboard');

    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles('fixtures/test-files/document.pdf');

    await expect(page.locator('[data-testid="error-toast"]'))
      .toContainText('Formato invalido');
  });

  test('should reject renamed exe files', async ({ page }) => {
    await loginAsUser(page, 'pro-user@test.com');
    await page.goto('/dashboard');

    await uploadFile(page, 'fixtures/test-files/fake-xlsm.exe.xlsm');

    await expect(page.locator('[data-testid="error-toast"]'))
      .toContainText('Arquivo nao e um Excel valido');
  });
});
```

### Configuracao Playwright

**playwright.config.ts**
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['junit', { outputFile: 'test-results/junit.xml' }]],
  use: {
    baseURL: process.env.TEST_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
  },
});
```

### CI Integration

Adicionar ao `.github/workflows/ci.yml`:

```yaml
  e2e-tests:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      - name: Run E2E tests
        run: npx playwright test
        env:
          TEST_URL: http://localhost:8080
          STRIPE_TEST_KEY: ${{ secrets.STRIPE_TEST_KEY }}
      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Conclusao

O PLANO_QA.md e **solido e bem estruturado**, cobrindo a maioria dos riscos operacionais. As lacunas identificadas sao principalmente relacionadas a **enforcement server-side** e **validacao profunda de arquivos** - areas que requerem implementacao adicional antes do go-live de producao.

**Recomendacao**: Incorporar os itens P0 ao checklist Go/No-Go antes de autorizar deploy.

**Decisoes Confirmadas**:
- Plataforma de hospedagem: **Vercel** (remover netlify.toml)
- Validacao server-side: **Implementar Edge Function** validate-processing
- Testes E2E: **Playwright** com cobertura de Chrome, Firefox, Safari, Mobile
