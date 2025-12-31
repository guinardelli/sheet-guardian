# Sheet Guardian - Plano de Produção QA/SRE

> **Timeline**: 1-2 meses (Completo)
> **Monitoring**: Sentry
> **Stripe**: Migrar de test para live mode
> **Gerado em**: 2025-12-31

---

## Sumário Executivo

Este documento detalha o plano completo para colocar o Sheet Guardian em produção com segurança. O aplicativo é uma SPA React + Supabase que processa arquivos Excel (.xlsm) para modificar padrões binários VBA, com modelo de assinatura (free/professional/premium) integrado ao Stripe.

### Status Atual
- **Build/CI**: Build OK; lint/type-check OK; falta staging (sourcemaps desabilitados em prod)
- **Testes**: Unitarios OK; E2E OK (smoke/plans/auth/a11y/upload). Checkout pendente (`E2E_CHECKOUT`)
- **Segurança**: CSP sem `unsafe-eval`; 2FA TOTP implementado (ativar no Supabase)
- **Dependencias**: `npm audit --omit=dev` OK; `npm audit` mostra moderadas em tools MCP (dev)
- **Observabilidade**: Sentry SDK integrada; DSN/alerts pendentes (guia `docs/SENTRY_ALERTS.md`)
- **Backups**: log criado; guia de restore em `BACKUP_RESTORE.md`; restore pendente
- **Stripe**: `.env` tem apenas key de teste; faltam IDs/segredos live
- **LGPD**: Paginas de Privacidade/Termos criadas; falta revisao juridica

### Andamento (2025-12-31)
- ✅ Sourcemaps desabilitados para build de producao.
- ✅ SDK do Sentry integrado no app; pendente configurar `VITE_SENTRY_DSN` e alertas no dashboard.
- ✅ Paginas de Privacidade e Termos criadas e roteadas.
- ✅ CSP atualizada (removido `unsafe-eval`).
- ✅ Runbooks de incidentes e deploy criados.
- ✅ Job de cleanup de tokens criado (agendar no Supabase).
- ✅ Fetch com retry implementado para chamadas criticas.
- ✅ Playwright configurado com testes E2E basicos (smoke/auth/plans/upload/checkout).
- ✅ Feature flags adicionadas (`src/lib/feature-flags.ts`).
- ✅ Testes a11y com axe-core adicionados.
- ✅ Testes unitarios de validacao de arquivos e auth adicionados.
- ✅ Documentacao de arquitetura adicionada.
- ✅ DAST configurado via workflow manual (OWASP ZAP).
- ✅ Guia de staging adicionado.
- ✅ Guias externos criados: Stripe live (`docs/STRIPE_LIVE_SETUP.md`), Sentry alerts (`docs/SENTRY_ALERTS.md`), uptime (`docs/UPTIME_MONITORING.md`), backup restore (`BACKUP_RESTORE.md`), schedule (`docs/SUPABASE_SCHEDULES.md`).
- ✅ Stripe: IDs agora suportam env (`VITE_STRIPE_*`) com fallback; falta definir IDs live e configurar webhook.
- ✅ Verificacao de `.env`: apenas `STRIPE_SECRET_KEY` de teste; `STRIPE_WEBHOOK_SECRET` e `VITE_STRIPE_*` ausentes.
- ✅ Unit tests rodados (vitest --run) e ajuste de validacao de mime/magic bytes; Vitest agora ignora `e2e/**`.
- ✅ E2E rodado (Playwright): smoke/plans/auth/a11y/upload ok; checkout pendente (`E2E_CHECKOUT=false`).
- ✅ Lint + type-check + build executados (lint limpo; build ok). Aviso: browserslist DB desatualizado.
- ✅ Dependencias: MCP tools movidos para `devDependencies`; `npm audit --omit=dev` sem vulnerabilidades.
- ✅ Browserslist DB atualizado via `update-browserslist-db`.
- ✅ E2E com credenciais fornecidas executado (upload validado e botao habilitado).
- ✅ 2FA TOTP opcional implementado (flag `VITE_FEATURE_2FA`).
- ⏳ Staging: template `.env.staging.example` criado; falta projeto Supabase + Vercel/CI.
- ⏳ Backup: log criado; teste de restore pendente.
- ⏳ Stripe live mode, alertas e uptime monitoring dependem de configuracao externa (dashboards).

---

## 1. Contexto Técnico

### Stack
| Camada | Tecnologia | Arquivo Principal |
|--------|------------|-------------------|
| Frontend | React 18 + TypeScript 5.8 + Vite | `src/App.tsx` |
| UI | Tailwind CSS + shadcn/ui | `src/components/ui/` |
| Backend | Supabase Edge Functions (Deno) | `supabase/functions/` |
| Database | PostgreSQL (Supabase) | `supabase/migrations/` |
| Auth | Supabase Auth | `src/hooks/useAuth.tsx` |
| Payments | Stripe | `src/lib/stripe.ts` |
| Deploy | Vercel (static) | `vercel.json` |

### Módulos Críticos
1. **Processamento Excel**: `src/lib/excel-vba-modifier.ts:48-251`
2. **Subscription Logic**: `src/hooks/useSubscription.tsx:45-525`
3. **Validação de Arquivos**: `src/lib/file-validation.ts:1-30`
4. **Edge Function Validate**: `supabase/functions/validate-processing/index.ts`
5. **Stripe Webhook**: `supabase/functions/stripe-webhook/index.ts`

### Planos de Assinatura
```typescript
free:         { sheetsPerMonth: 1, maxFileSizeMB: 1 }
professional: { sheetsPerWeek: 5, maxFileSizeMB: 1, price: $32/mês }
premium:      { unlimited, unlimited, price: $38/mês }
```

---

## 2. Checklist de Implementação

### Prioridade P0 - Bloqueiam Produção

#### 2.1 Desabilitar Sourcemaps em Produção
**Arquivo**: `vite.config.ts`
**Linha**: 19
**Status**: ✅ Implementado (sourcemap condicionado ao modo)
**Mudança**:
```typescript
// DE:
build: {
  sourcemap: true,
  // ...
}

// PARA:
build: {
  sourcemap: false, // Desabilitar em produção
  // ...
}
```
**Justificativa**: Sourcemaps expõem código fonte completo, facilitando engenharia reversa.

---

#### 2.2 Configurar Sentry
**Arquivos a criar/modificar**:
1. `src/lib/sentry.ts` (novo)
2. `src/main.tsx` (modificar)
3. `.env` (adicionar VITE_SENTRY_DSN)

**Status**: ✅ SDK integrada; ⏳ pendente configurar `VITE_SENTRY_DSN` no ambiente

**Implementação**:
```typescript
// src/lib/sentry.ts
import * as Sentry from "@sentry/react";

export function initSentry() {
  if (import.meta.env.PROD) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      environment: import.meta.env.MODE,
    });
  }
}
```

```typescript
// src/main.tsx - adicionar no topo
import { initSentry } from './lib/sentry';
initSentry();
```

**Dependência a instalar**:
```bash
npm install @sentry/react
```

---

#### 2.3 Migrar Stripe para Live Mode
**Arquivos**: `.env`, `src/lib/stripe.ts`

**Status**: ⏳ Em andamento (IDs via env; `.env` com key de teste; faltam credenciais live, webhook e IDs de produtos/precos)

**Checklist**:
1. [ ] Criar produtos/preços no Stripe Dashboard (live mode)
2. [ ] Atualizar `.env`:
   ```env
   STRIPE_SECRET_KEY=sk_live_XXXXX
   STRIPE_WEBHOOK_SECRET=whsec_XXXXX
   ```
   ```env
   VITE_STRIPE_PROFESSIONAL_PRODUCT_ID=prod_LIVE_ID
   VITE_STRIPE_PROFESSIONAL_PRICE_ID=price_LIVE_ID
   VITE_STRIPE_PREMIUM_PRODUCT_ID=prod_LIVE_ID
   VITE_STRIPE_PREMIUM_PRICE_ID=price_LIVE_ID
   ```
3. [ ] Atualizar IDs em `src/lib/stripe.ts`:
   ```typescript
   export const STRIPE_PRODUCTS = {
     professional: {
       product_id: 'prod_LIVE_ID',
       price_id: 'price_LIVE_ID',
     },
     premium: {
       product_id: 'prod_LIVE_ID',
       price_id: 'price_LIVE_ID',
     },
   };
   ```
4. [ ] Configurar webhook no Stripe Dashboard apontando para:
   `https://[PROJECT_ID].supabase.co/functions/v1/stripe-webhook`
5. [ ] Testar checkout completo em live mode

---

#### 2.4 Criar Página de Política de Privacidade
**Arquivo**: `src/pages/Privacy.tsx` (novo)

**Status**: ✅ Implementado

**Conteúdo mínimo** (adaptar para advogado revisar):
- Dados coletados (email, IP, uso)
- Processamento de arquivos (client-side only)
- Cookies utilizados
- Compartilhamento com terceiros (Stripe, Supabase)
- Direitos do usuário (LGPD)
- Contato DPO

**Rota**: Adicionar em `src/App.tsx`:
```typescript
<Route path="/privacy" element={<Privacy />} />
```

---

#### 2.5 Criar Página de Termos de Uso
**Arquivo**: `src/pages/Terms.tsx` (novo)

**Status**: ✅ Implementado

**Conteúdo mínimo**:
- Descrição do serviço
- Limitações de uso por plano
- Responsabilidades do usuário
- Limitação de responsabilidade
- Política de reembolso
- Jurisdição (Brasil)

**Rota**: Adicionar em `src/App.tsx`:
```typescript
<Route path="/terms" element={<Terms />} />
```

---

#### 2.6 Configurar Alertas
**Opção A - Sentry Alerts** (recomendado):
**Status**: ⏳ Pendente (guia em `docs/SENTRY_ALERTS.md`; configuracao no dashboard)
1. Sentry Dashboard → Alerts → Create Alert
2. Configurar:
   - Error rate > 5% em 5 min → Email + Slack
   - New issue → Email
   - Performance P95 > 5s → Email

**Opção B - Criar Edge Function de Health Check com Alertas**:
```typescript
// supabase/functions/health-check/index.ts - já existe
// Configurar monitoramento externo (Better Stack, UptimeRobot)
```

---

#### 2.7 Configurar Uptime Monitoring
**Serviço recomendado**: Better Stack (free tier disponível)
**Status**: ⏳ Pendente (guia em `docs/UPTIME_MONITORING.md`; configuracao no provedor)

**Endpoints a monitorar**:
1. `https://vbablocker.vercel.app/` - Frontend
2. `https://[PROJECT].supabase.co/functions/v1/health-check` - Edge Functions
3. `https://[PROJECT].supabase.co/auth/v1/health` - Supabase Auth

**Alertas**:
- Downtime > 1 min → Slack
- Downtime > 5 min → SMS

---

### Prioridade P1 - Primeira Semana Pós-Launch

#### 2.8 Criar Ambiente de Staging
**Status**: ⏳ Template `.env.staging.example` e guia `docs/STAGING.md` criados; falta projeto/configuracoes
**Passos**:
1. [ ] Criar novo projeto Supabase (staging)
2. [ ] Executar migrations no staging
3. [ ] Configurar Vercel preview deployments
4. [ ] Criar `.env.staging`:
   ```env
   VITE_SUPABASE_URL=https://[STAGING].supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=[STAGING_ANON_KEY]
   STRIPE_SECRET_KEY=sk_test_XXXXX
   ```
5. [ ] Atualizar CI para deploy automático em staging

---

#### 2.9 Implementar Testes E2E com Playwright
**Arquivo**: `playwright.config.ts` (criar)
**Diretório**: `e2e/` (criar)
**Status**: ✅ Implementado (config e testes com gating via env)
**Notas**: `PLAYWRIGHT_BASE_URL`, `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_UPLOAD_FILE`, `E2E_CHECKOUT`
**Arquivos criados**: `e2e/smoke.spec.ts`, `e2e/auth.spec.ts`, `e2e/plans.spec.ts`, `e2e/upload.spec.ts`, `e2e/checkout.spec.ts`

**Testes prioritários**:
```typescript
// e2e/auth.spec.ts
test('signup flow', async ({ page }) => {
  await page.goto('/auth');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'ValidPass123!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard');
});

// e2e/upload.spec.ts
test('process file within limits', async ({ page }) => {
  // Login
  // Upload file
  // Verify download
});

// e2e/checkout.spec.ts
test('upgrade to professional', async ({ page }) => {
  // Login as free user
  // Go to plans
  // Click upgrade
  // Verify redirect to Stripe
});
```

**Scripts** em `package.json`:
```json
{
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

---

#### 2.10 Remover unsafe-eval do CSP
**Arquivo**: `vercel.json:34`
**Status**: ✅ Implementado

**Mudança**:
```json
// DE:
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net"

// PARA:
"script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net"
```

**Nota**: Verificar se alguma biblioteca requer `eval()`. Se build quebrar, investigar e resolver.

---

#### 2.11 Criar Runbook de Incidentes
**Arquivo**: `docs/RUNBOOK_INCIDENTS.md` (criar)
**Status**: ✅ Implementado

**Conteúdo**:
```markdown
# Runbook de Incidentes

## Severidade
- **SEV1**: App completamente fora do ar
- **SEV2**: Feature crítica quebrada (pagamentos, upload)
- **SEV3**: Bug afetando subset de usuários
- **SEV4**: Issue cosmético

## Procedimentos

### SEV1 - App Fora do Ar
1. Verificar Vercel status
2. Verificar Supabase status
3. Verificar Stripe status
4. Se problema interno: rollback para última versão estável
5. Comunicar em #incidents no Slack

### Rollback Procedure
1. Vercel Dashboard → Deployments
2. Encontrar último deploy estável
3. Click "Promote to Production"
4. Verificar smoke tests
5. Monitorar métricas por 15 min

### Contatos de Emergência
- DevOps: [NOME] - [TELEFONE]
- Backend: [NOME] - [TELEFONE]
```

---

#### 2.12 Criar Runbook de Deploy
**Arquivo**: `docs/RUNBOOK_DEPLOY.md` (criar)
**Status**: ✅ Implementado

**Conteúdo**:
```markdown
# Runbook de Deploy

## Pre-Deploy Checklist
- [ ] Todos os testes passando (CI verde)
- [ ] Code review aprovado
- [ ] Migrations testadas em staging
- [ ] Changelog atualizado

## Deploy para Staging
1. Merge PR para branch `staging`
2. CI executa automaticamente
3. Verificar preview deployment
4. Executar smoke tests
5. Testar fluxos críticos manualmente

## Deploy para Production
1. Merge `staging` para `main`
2. CI executa automaticamente
3. Monitorar Sentry por 15 min
4. Verificar métricas no dashboard
5. Comunicar em #releases

## Post-Deploy Verification
```bash
# Smoke tests
curl https://vbablocker.vercel.app/ # Expect: HTML
curl https://[PROJECT].supabase.co/functions/v1/health-check # Expect: {"status":"ok"}
```
```

---

#### 2.13 Job de Cleanup de Tokens Expirados
**Opção A - Supabase Scheduled Function** (recomendado):
**Status**: ✅ Implementado (codigo); ⏳ agendar no Supabase (guia em `docs/SUPABASE_SCHEDULES.md`)

Criar `supabase/functions/cleanup-tokens/index.ts`:
```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Deletar tokens expirados há mais de 24 horas
  const { error, count } = await supabase
    .from("processing_tokens")
    .delete()
    .lt("expires_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ deleted: count }), { status: 200 });
});
```

Configurar cron no Supabase Dashboard → Edge Functions → Schedule

---

#### 2.14 Testar Restore de Backup
**Log**: `docs/BACKUP_TEST_LOG.md`
**Procedimento**:
**Status**: ⏳ Log criado; guia em `BACKUP_RESTORE.md`; restauracao pendente (nenhum `.dump` local encontrado; `SUPABASE_DB_URL` ausente)
1. Baixar último backup de GitHub Actions artifacts
2. Criar banco PostgreSQL local ou novo projeto Supabase
3. Executar restore:
   ```bash
   pg_restore -d postgresql://... backup_YYYYMMDD.dump
   ```
4. Verificar integridade dos dados
5. Documentar resultado em `docs/BACKUP_TEST_LOG.md`

---

#### 2.15 Adicionar Retry com Backoff
**Arquivo**: `src/lib/fetch-with-retry.ts` (criar)
**Status**: ✅ Implementado e usado em chamadas criticas

```typescript
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelay = 1000
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status < 500) {
        return response;
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}
```

**Usar em**: `useSubscription.tsx`, `useAuth.tsx` para chamadas críticas.

---

### Prioridade P2 - Primeiro Mês

#### 2.16 Implementar 2FA/MFA
**Supabase suporta TOTP nativamente**.
**Status**: ✅ Implementado (TOTP opcional com fluxo simples de verificacao)
**Nota**: habilitar MFA TOTP no Supabase Auth e definir `VITE_FEATURE_2FA=true` no ambiente desejado.

**Passos**:
1. Habilitar MFA no Supabase Dashboard
2. Criar componente `src/components/MFASetup.tsx`
3. Adicionar fluxo em `src/pages/Account.tsx`
4. Verificar MFA em `useAuth.tsx`

---

#### 2.17 Lazy Loading de Rotas
**Arquivo**: `src/App.tsx`
**Status**: ✅ Ja implementado

**Mudança**:
```typescript
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Plans = lazy(() => import('./pages/Plans'));
const Account = lazy(() => import('./pages/Account'));

// No JSX:
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    {/* ... */}
  </Routes>
</Suspense>
```

---

#### 2.18 Sistema de Feature Flags
**Opção simples**: Variáveis de ambiente
**Status**: ✅ Implementado (`src/lib/feature-flags.ts`)

```typescript
// src/lib/feature-flags.ts
export const FLAGS = {
  ENABLE_2FA: import.meta.env.VITE_FEATURE_2FA === 'true',
  ENABLE_BATCH_UPLOAD: import.meta.env.VITE_FEATURE_BATCH === 'true',
};

// Uso:
if (FLAGS.ENABLE_2FA) {
  // render 2FA UI
}
```

---

#### 2.19 APM/Tracing com Sentry
Já incluído na configuração do Sentry (item 2.2):
- `browserTracingIntegration()` captura traces
- `tracesSampleRate: 0.1` = 10% das transações
**Status**: ✅ Configurado (pendente DSN em ambiente)

---

#### 2.20 Testes de Acessibilidade
**Ferramenta**: axe-core com Playwright
**Status**: ✅ Implementado (`e2e/a11y.spec.ts`)

```typescript
// e2e/accessibility.spec.ts
import AxeBuilder from '@axe-core/playwright';

test('home page accessibility', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

**Instalar**:
```bash
npm install -D @axe-core/playwright
```

---

## 3. Matriz de Riscos (Top 15)

| # | Risco | Impacto | Prob. | Mitigação | Dono |
|---|-------|---------|-------|-----------|------|
| 1 | Stripe webhook falha silenciosamente | ALTO | MÉDIO | Monitorar eventos não processados, alertas | Backend |
| 2 | Supabase fora do ar | ALTO | BAIXO | Healthcheck + graceful degradation | Infra |
| 3 | Token de processamento explorado | ALTO | BAIXO | Tokens single-use + logs | Security |
| 4 | Rate limit bypass via IP rotation | MÉDIO | MÉDIO | Adicionar rate limit por user_id | Security |
| 5 | Arquivo malicioso como .xlsm | ALTO | BAIXO | Validação magic bytes + sandbox | Security |
| 6 | Vazamento de sourcemaps | MÉDIO | ALTO | Desabilitar em prod (P0) | DevOps |
| 7 | Secrets expostos em logs | ALTO | BAIXO | Audit de logs, sanitização | Security |
| 8 | Backup corrompido | ALTO | MÉDIO | Testar restore mensalmente | Infra |
| 9 | Downgrade não sincroniza | MÉDIO | MÉDIO | Webhook subscription.deleted | Backend |
| 10 | XSS via nome de arquivo | ALTO | BAIXO | React escape + CSP | Security |
| 11 | Timezone causa reset errado | MÉDIO | MÉDIO | Usar UTC, testes | Backend |
| 12 | Deploy sem testes quebra prod | ALTO | MÉDIO | Staging obrigatório | DevOps |
| 13 | Race condition em usage | MÉDIO | BAIXO | Lock implementado, verificar | Backend |
| 14 | Ausência de staging | MÉDIO | ALTO | Criar staging (P1) | DevOps |
| 15 | Email não chega | MÉDIO | MÉDIO | Monitorar Resend | Infra |

---

## 4. Plano de Testes

### 4.1 Testes Unitários (Vitest)
**Cobertura atual**: ~30%
**Meta**: 70%

| Módulo | Arquivo de Teste | Status |
|--------|-----------------|--------|
| Excel Processing | `excel-vba-modifier.test.ts` | ✅ Existe |
| Subscription | `useSubscription.test.ts` | ✅ Existe |
| File Validation | `file-validation.test.ts` | ✅ Existe |
| Auth Logic | `useAuth.test.ts` | ✅ Existe |
| Date Utils | `date-utils.test.ts` | ✅ Coberto em `useSubscription.test.ts` |

Ultima execucao: 2025-12-31 (vitest --run)

### 4.2 Testes E2E (Playwright)
| Fluxo | Arquivo | Prioridade |
|-------|---------|------------|
| Signup → Login | `e2e/auth.spec.ts` | P0 |
| Upload → Download | `e2e/upload.spec.ts` | P0 |
| Checkout | `e2e/checkout.spec.ts` | P0 |
| Rate Limiting | `e2e/rate-limit.spec.ts` | P1 |
| Acessibilidade | `e2e/a11y.spec.ts` | P2 |

Nota: E2E deve rodar via Playwright (`npm run test:e2e`), separado do Vitest.
Ultima execucao: 2025-12-31 (Playwright) -> 6 passed, 1 skipped (checkout desativado por `E2E_CHECKOUT`).

Lint/Type-check/Build: 2025-12-31 (lint OK, type-check OK, build OK; browserslist DB desatualizado).

Encerramento:
- Sessao finalizada a pedido do usuario. Todos os passos automatizaveis concluidos.
- Itens pendentes exigem configuracoes externas ou credenciais (ver pendencias abaixo).

Pendencias para proxima etapa:
- Stripe live mode: credenciais e IDs live + webhook no Stripe Dashboard.
- Sentry: definir `VITE_SENTRY_DSN` e configurar alertas.
- Uptime monitoring: configurar provedor (ex.: Better Stack) com endpoints.
- Staging: criar projeto Supabase + Vercel preview/CI.
- Backup restore: obter `.dump` e `SUPABASE_DB_URL` e registrar resultado no log.
- E2E checkout: habilitar `E2E_CHECKOUT=true` para validar fluxo com pagamento.

### 4.3 Testes de Segurança
| Teste | Ferramenta | Status |
|-------|------------|--------|
| SAST | CodeQL | ✅ CI |
| Dependency Scan | npm audit | ✅ CI |
| DAST | OWASP ZAP | ✅ Configurado (`.github/workflows/dast.yml`) |

---

## 5. Testes Específicos (Given/When/Then)

### Teste: Processamento de Arquivo
```gherkin
Scenario: Usuário free processa arquivo válido
  Given usuário autenticado com plano "free"
  And sheets_used_month = 0
  And arquivo .xlsm válido < 1MB
  When faz upload do arquivo
  Then processing token é gerado
  And arquivo é modificado (padrões VBA)
  And sheets_used_month = 1
  And download é oferecido

Scenario: Usuário free excede limite
  Given usuário com plano "free"
  And sheets_used_month = 1
  When tenta upload
  Then erro "Limite mensal atingido"
  And suggestUpgrade = true
```

### Teste: Autorização por Plano
```gherkin
Scenario: Tentativa de bypass de token
  Given token pertence a user_id_A
  When user_id_B tenta consumir token
  Then erro 403 "Invalid processing token"
  And token não é consumido

Scenario: Token expirado
  Given token gerado há > 5 minutos
  When tenta consumir
  Then erro "Processing token expired"
```

### Teste: Webhook Stripe
```gherkin
Scenario: checkout.session.completed
  Given evento com metadata.user_id válido
  When webhook processa
  Then subscription.plan atualizado
  And contadores resetados
  And email enviado
  And evento marcado como processado

Scenario: Evento duplicado
  Given event_id já existe em stripe_webhook_events
  When mesmo evento é recebido
  Then retorna 200 (sucesso)
  And NÃO processa novamente
```

---

## 6. CI/CD Pipeline

### Pipeline Atual
```
Checkout → Setup Node → npm ci → npm audit → Lint → Type-check → Tests → Build → Upload artifact
```

### Pipeline Recomendado
```yaml
jobs:
  quality:     # Lint + Type-check
  security:    # npm audit + CodeQL + secrets scan
  test:        # Unit tests + coverage gate (70%)
  build:       # Build (sourcemaps OFF)
  e2e:         # Playwright (apenas staging/main)
  deploy:      # Vercel (apenas main)
```

### Gates Obrigatórios
| Gate | Critério | Bloqueia? |
|------|----------|-----------|
| Lint | 0 erros | ✅ |
| Type-check | 0 erros | ✅ |
| npm audit | 0 high | ✅ |
| Coverage | >= 70% | ✅ |
| E2E | 100% pass | ✅ |

---

## 7. Configurações por Ambiente

| Variável | Dev | Staging | Prod |
|----------|-----|---------|------|
| `VITE_SUPABASE_URL` | localhost | staging.supabase.co | prod.supabase.co |
| `STRIPE_SECRET_KEY` | sk_test_* | sk_test_* | sk_live_* |
| `VITE_SENTRY_DSN` | - | staging DSN | prod DSN |

### Validação de Secrets
```bash
# Rodar antes de deploy
grep -rn "sk_live_\|sk_test_\|whsec_" src/ --include="*.ts"
# Esperado: 0 resultados
```

---

## 8. Rollback Procedure

1. **Identificar problema**: Sentry alerts, uptime monitoring
2. **Acessar Vercel Dashboard** → Deployments
3. **Encontrar último deploy estável** (verde, sem erros)
4. **Click "Promote to Production"**
5. **Verificar smoke tests**:
   ```bash
   curl https://vbablocker.vercel.app/
   curl https://[PROJECT].supabase.co/functions/v1/health-check
   ```
6. **Monitorar Sentry** por 15 minutos
7. **Comunicar em Slack** #incidents

---

## 9. SLOs e Métricas

| Métrica | SLO | Alerta Threshold |
|---------|-----|------------------|
| Uptime | 99.5% | < 99% em 1h |
| Error Rate | < 1% | > 2% em 5min |
| P95 Latency | < 3s | > 5s em 5min |
| Webhook Success | > 99% | < 95% em 1h |

---

## 10. Arquivos Críticos para Modificação

| Arquivo | Mudança | Prioridade |
|---------|---------|------------|
| `vite.config.ts:19` | `sourcemap: false` | P0 |
| `vercel.json:34` | Remover `unsafe-eval` | P1 |
| `.env` | Rotacionar todas keys | P0 |
| `src/lib/stripe.ts` | IDs live mode | P0 |
| `src/App.tsx` | Lazy loading | P2 |
| `package.json:4` | Version > 0.0.0 | P2 |

---

## 11. Cronograma Sugerido

### Semana 1-2: P0 (Bloqueadores)
- [x] Sourcemaps desabilitados
- [x] Sentry configurado (SDK integrada; falta DSN/alerts)
- [ ] Stripe live mode
- [x] Páginas Privacy/Terms
- [ ] Alertas configurados
- [ ] Uptime monitoring

### Semana 3-4: P1 (Estabilização)
- [ ] Ambiente staging
- [x] Testes E2E básicos
- [x] CSP sem unsafe-eval
- [x] Runbooks criados
- [x] Cleanup job
- [ ] Backup testado

### Semana 5-8: P2 (Melhorias)
- [x] 2FA/MFA
- [x] Lazy loading
- [x] Feature flags
- [x] APM completo (pendente DSN em ambiente)
- [x] Testes a11y
- [x] Documentação arquitetura

---

## 12. Checklist Final Pré-Launch

- [ ] Todos os itens P0 completos
- [ ] Staging funcionando
- [ ] Smoke tests passando
- [ ] Sentry recebendo eventos
- [ ] Uptime monitoring ativo
- [ ] Runbooks revisados
- [ ] Backup verificado
- [ ] Stripe em live mode
- [ ] Privacy/Terms publicados
- [ ] DNS/SSL configurados
- [ ] Comunicação de launch preparada

---

*Documento gerado automaticamente em 2025-12-31*
*Para dúvidas: consulte CLAUDE.md ou o time de desenvolvimento*
