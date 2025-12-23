# Plano: Preparação Enterprise-Grade para Produção - Sheet Guardian

## Resumo Executivo

Após análise completa do código, identifiquei **7 problemas críticos** que impedem deploy e **15 problemas de alta prioridade**. Com base na sua escolha de **produção enterprise-grade**, este plano cobre 2-3 semanas de trabalho estruturado.

**Status Atual**: ❌ NÃO PRONTO PARA PRODUÇÃO
**Objetivo**: ✅ Sistema enterprise-grade, seguro, testado e monitorado
**Timeline**: 18 dias úteis (2.5-3 semanas) + 2-3 dias de buffer
**Plataforma**: Vercel (já configurada)

---

## ❌ PROBLEMAS CRÍTICOS (Bloqueiam Produção)

### 1. Build Falhando
- **Localização**: Processo de build do Vite
- **Erro**: `EISDIR: illegal operation on a directory, read`
- **Impacto**: Impossível fazer deploy
- **Solução**: Investigar e corrigir configuração do Vite

### 2. Edge Functions SEM Autenticação
- **Localização**: `supabase/config.toml`
- **Problema**: Todas as funções com `verify_jwt = false`
- **Impacto**: Qualquer pessoa pode criar checkouts Stripe ou verificar assinaturas
- **Solução**: Alterar para `verify_jwt = true` em todas as funções

### 3. Webhook do Stripe Ausente
- **Localização**: Falta criar `supabase/functions/stripe-webhook/index.ts`
- **Impacto**: Assinaturas não sincronizam automaticamente após pagamento/cancelamento
- **Solução**: Implementar webhook handler com verificação de assinatura

### 4. Bug de Contagem Semanal
- **Localização**: `src/hooks/useSubscription.tsx:224`
- **Problema**: Contador `sheets_used_today` reseta diariamente em vez de semanalmente (plano Professional)
- **Impacto**: Usuários Professional podem processar 5 arquivos POR DIA em vez de 5 POR SEMANA
- **Solução**: Corrigir lógica de reset ou renomear variável

### 5. CORS Muito Permissivo
- **Localização**: Todas as Edge Functions
- **Problema**: `Access-Control-Allow-Origin: "*"`
- **Impacto**: Qualquer site pode fazer requisições às suas funções
- **Solução**: Restringir para domínio de produção

### 6. Falta de CSP no Vercel
- **Localização**: `vercel.json`
- **Problema**: Content-Security-Policy ausente (só existe no netlify.toml)
- **Impacto**: Vulnerável a XSS attacks
- **Solução**: Adicionar CSP headers no vercel.json

### 7. Console.log em Produção
- **Localização**: 18 ocorrências em vários arquivos
- **Problema**: Logs expostos no browser
- **Impacto**: Vazamento de informações sensíveis
- **Solução**: Remover ou envolver em `if (import.meta.env.DEV)`

---

## ⚠️ PROBLEMAS DE ALTA PRIORIDADE (Resolver logo após lançamento)

### 8. Falta de IDs do Stripe no Banco
- **Localização**: Tabela `subscriptions`
- **Problema**: Sem `stripe_customer_id` e `stripe_subscription_id`
- **Impacto**: Lookups lentos e ineficientes
- **Solução**: Adicionar colunas e migration

### 9. Rate Limiting Não Ativado
- **Localização**: `src/pages/Auth.tsx`
- **Problema**: Função `check_rate_limit()` existe mas não é chamada
- **Impacto**: Vulnerável a brute force attacks
- **Solução**: Integrar check_rate_limit no fluxo de autenticação

### 10. Falha no incrementUsage Permite Bypass
- **Localização**: `src/pages/Dashboard.tsx:224-237`
- **Problema**: Se incrementUsage() falhar, usuário recebe o arquivo processado
- **Impacto**: Pode processar ilimitadamente se DB estiver offline
- **Solução**: Bloquear download se incremento falhar

### 11. Arquivos Sem VBA Contam no Limite
- **Localização**: `src/lib/excel-vba-modifier.ts:145-163`
- **Problema**: Arquivos sem VBA são "processados" e contam na cota
- **Impacto**: Usuários desperdiçam suas cotas
- **Solução**: Validar presença de VBA antes de incrementar

### 12. TypeScript Muito Permissivo
- **Localização**: `tsconfig.json`
- **Problema**: `noImplicitAny: false`, `strictNullChecks: false`
- **Impacto**: Bugs não detectados em compilação
- **Solução**: Endurecer configurações gradualmente

### 13. Variáveis de Ambiente do Stripe
- **Localização**: `.env.example`
- **Problema**: `STRIPE_SECRET_KEY` não documentada
- **Impacto**: Deploy pode falhar sem documentação
- **Solução**: Adicionar ao .env.example

### 14. Sem HSTS Header
- **Localização**: `vercel.json`
- **Problema**: Strict-Transport-Security ausente
- **Impacto**: Vulnerável a downgrade attacks
- **Solução**: Adicionar header HSTS

### 15. Sem Monitoramento de Erros
- **Localização**: Código geral
- **Problema**: Sentry mencionado mas não integrado
- **Impacto**: Bugs em produção não serão detectados
- **Solução**: Configurar Sentry ou similar

### 16. Component Duplicado (ExcelBlocker)
- **Localização**: `src/components/ExcelBlocker.tsx`
- **Problema**: Toda lógica duplicada no Dashboard.tsx
- **Impacto**: Confusão de manutenção
- **Solução**: Remover arquivo não usado

### 17. Sem Sitemap/SEO
- **Localização**: Falta `sitemap.xml`
- **Problema**: Dificulta indexação do Google
- **Impacto**: Menos visibilidade orgânica
- **Solução**: Gerar sitemap

### 18. Sem PWA Manifest
- **Localização**: Falta `manifest.json`
- **Problema**: Não pode ser instalado como app
- **Impacto**: Pior experiência mobile
- **Solução**: Criar manifest

### 19. Sem CI/CD
- **Localização**: Falta `.github/workflows/`
- **Problema**: Deploy manual, sem testes automáticos
- **Impacto**: Mais propenso a erros
- **Solução**: Configurar GitHub Actions

### 20. Sem Backup Strategy
- **Localização**: Documentação
- **Problema**: Nenhum plano de backup documentado
- **Impacto**: Risco de perda de dados
- **Solução**: Documentar estratégia de backup

### 21. payment_method Não Usado
- **Localização**: Tabela `subscriptions`
- **Problema**: Campo definido mas nunca populado
- **Impacto**: Dado inútil ocupando espaço
- **Solução**: Remover ou implementar sync

### 22. Sem Data de Término da Assinatura
- **Localização**: Tabela `subscriptions`
- **Problema**: `subscription_end` retornado mas não armazenado
- **Impacto**: Usuário não vê quando renova
- **Solução**: Adicionar coluna `subscription_end_date`

---

## ✅ PONTOS FORTES ENCONTRADOS

1. ✅ Autenticação com Supabase bem implementada
2. ✅ Integração Stripe completa (checkout + portal)
3. ✅ Row-Level Security habilitada
4. ✅ Validação de senha robusta
5. ✅ Proteção contra race conditions
6. ✅ Processamento de Excel funcional
7. ✅ UI/UX bem desenvolvida
8. ✅ Headers de segurança básicos no Vercel
9. ✅ .env gitignored corretamente
10. ✅ Migrations do banco organizadas

---

## 📋 PLANO DE IMPLEMENTAÇÃO ENTERPRISE-GRADE

### FASE 1: Correções Críticas & Estabilização do Build (Dias 1-3)
**Objetivo**: Resolver problemas bloqueadores, estabilizar build, corrigir bugs de segurança e dados

**Tarefas Detalhadas:**

#### 1.1 Investigar e Corrigir Build Failure (Dia 1, 4h)
- **Problema**: `EISDIR: illegal operation on a directory, read`
- **Arquivo**: `vite.config.ts`
- **Ação**: Verificar se index.html está acessível, adicionar configuração explícita:
  ```typescript
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html')
      }
    }
  }
  ```
- **Teste**: `npm run build` deve completar sem erros
- **Status**: CONCLUIDO - ajustado `index.html` (canonical URL absoluta) e `npm run build` passou

#### 1.2 Ativar JWT Verification (Dia 1, 2h)
- **Arquivo**: `supabase/config.toml`
- **Mudança**: `verify_jwt = false` → `verify_jwt = true` em:
  - `[functions.create-checkout]`
  - `[functions.check-subscription]`
  - `[functions.customer-portal]`
- **Exceção**: webhook mantém `verify_jwt = false` (usa signature)
- **Teste**: Verificar requests autenticados funcionam, não-autenticados retornam 401
- **Status**: CONCLUIDO - verify_jwt habilitado em create-checkout, check-subscription, customer-portal

#### 1.3 Corrigir Bug de Contagem Semanal (Dia 2, 4h)
- **Problema**: `sheets_used_today` usado para contagem semanal, mas reseta diariamente
- **Migration**: `supabase/migrations/YYYYMMDD_fix_weekly_counting.sql`
  ```sql
  ALTER TABLE subscriptions ADD COLUMN sheets_used_week INTEGER NOT NULL DEFAULT 0;
  UPDATE subscriptions SET sheets_used_week = sheets_used_today
  WHERE last_sheet_date IS NOT NULL;
  ```
- **Arquivo**: `src/hooks/useSubscription.tsx` linha 131
- **Mudança**: Usar `subscription.sheets_used_week` em vez de `sheets_used_today` para plano professional
- **Teste**: Processar arquivo, verificar contador correto no banco
- **Status**: CONCLUIDO - migration criada (`supabase/migrations/20251222_fix_weekly_counting.sql`) e uso semanal atualizado (useSubscription, Account, ExcelBlocker). Teste pendente

#### 1.4 Adicionar Campos Stripe no Banco (Dia 2, 3h)
- **Migration**: `supabase/migrations/YYYYMMDD_add_stripe_ids.sql`
  ```sql
  ALTER TABLE subscriptions ADD COLUMN stripe_customer_id TEXT UNIQUE;
  ALTER TABLE subscriptions ADD COLUMN stripe_subscription_id TEXT UNIQUE;
  ALTER TABLE subscriptions ADD COLUMN stripe_product_id TEXT;
  CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
  ```
- **Arquivo**: `src/integrations/supabase/types.ts` (atualizar tipos)
- **Teste**: Migration roda sem erros, novos campos aparecem no banco
- **Status**: CONCLUIDO - migration criada (`supabase/migrations/20251222_add_stripe_ids.sql`) e tipos atualizados em `src/integrations/supabase/types.ts`

#### 1.5 Atualizar Edge Functions para Usar Stripe IDs (Dia 3, 4h)
- **Arquivos**:
  - `supabase/functions/create-checkout/index.ts`
  - `supabase/functions/check-subscription/index.ts`
- **Mudanças**: Após criar/encontrar customer, salvar IDs no banco
- **Teste**: Fazer checkout test, verificar IDs salvos no banco
- **Status**: CONCLUIDO - create-checkout e check-subscription atualizados para salvar stripe_customer_id/stripe_subscription_id/stripe_product_id. Teste pendente

**Deliverables Fase 1**:
- ✅ Build funcionando sem erros
- ✅ Edge Functions seguras com JWT
- ✅ Bug semanal corrigido
- ✅ Stripe IDs sendo rastreados

### FASE 2: Integração Stripe Webhooks & Sincronização de Pagamentos (Dias 4-6)
**Objetivo**: Automatizar sincronização de assinaturas, implementar webhook, restringir CORS

**Tarefas Detalhadas:**

#### 2.1 Implementar Stripe Webhook Handler (Dia 4, 6h)
- **Criar**: `supabase/functions/stripe-webhook/index.ts`
- **Funcionalidade**:
  - Verificar assinatura do webhook (signature verification)
  - Handlers para eventos:
    - `checkout.session.completed` - Salvar customer/subscription IDs
    - `customer.subscription.created` - Ativar plano
    - `customer.subscription.updated` - Atualizar plano
    - `customer.subscription.deleted` - Downgrade para free
    - `invoice.payment_failed` - Marcar payment_status como failed
- **Config**: Adicionar ao `supabase/config.toml` com `verify_jwt = false`
- **Teste**: Usar Stripe CLI para simular eventos
- **Status**: CONCLUIDO - webhook criado em `supabase/functions/stripe-webhook/index.ts` e config adicionada. Teste pendente

#### 2.2 Restringir CORS (Dia 4, 2h)
- **Arquivos**: Todas Edge Functions
- **Mudança**: `Access-Control-Allow-Origin: "*"` → Lista de origens permitidas
- **Origens**:
  - `https://vbablocker.vercel.app` (produção)
  - `http://localhost:8080` (desenvolvimento)
- **Exceção**: `stripe-webhook` não precisa CORS (server-to-server)
- **Teste**: Verificar frontend funciona, origens não permitidas são bloqueadas
- **Status**: CONCLUIDO - CORS restrito em todas as Edge Functions (exceto stripe-webhook). Domínio atualizado para https://vbablocker.vercel.app. Teste pendente

#### 2.3 Configurar Webhook no Stripe Dashboard (Dia 5, 2h)
- **Manual**: Login no Stripe Dashboard
- **Passos**:
  1. Developers → Webhooks → Add endpoint
  2. URL: `https://dgweztejbixowxmfizgx.supabase.co/functions/v1/stripe-webhook`
  3. Selecionar eventos (5 eventos listados acima)
  4. Copiar webhook secret
  5. Adicionar como secret no Supabase: `STRIPE_WEBHOOK_SECRET`
- **Teste**: Enviar test event no Stripe Dashboard, verificar log no Supabase
- **Status**: CONCLUIDO (usuario)

#### 2.4 Verificar Produtos Stripe (Dia 5, 2h)
- **Checklist Stripe Dashboard**:
  - [x] Produto Professional (`prod_TaJslOsZAWnhcN`) existe
  - [x] Preço Professional (`price_1Sd9EhJkxX3Me4wlrU22rZwM`) = R$32/mês
  - [x] Produto Premium (`prod_TaJsysi99Q1g2J`) existe
  - [x] Preço Premium (`price_1Sd9F5JkxX3Me4wl1xNRb5Kh`) = R$38/mês
  - [x] Ambos configurados como recurring (mensal)
  - [x] Customer Portal habilitado
  - [x] Métodos de pagamento: PIX + Cartão
- **Ação**: Se produtos não existem ou preços diferentes, AVISAR para atualizar IDs no código
- **Status**: CONCLUIDO (usuario) - IDs e configuracoes confirmadas

#### 2.5 Testar Fluxo Completo de Pagamento (Dia 6, 4h)
- **Teste 1**: Usuário Free → Professional
  - Fazer checkout test
  - Verificar webhook recebido
  - Verificar plano atualizado no banco automaticamente
- **Teste 2**: Cancelar assinatura via Customer Portal
  - Abrir portal
  - Cancelar subscription
  - Verificar downgrade para free automaticamente
- **Teste 3**: Payment failure simulado
  - Usar Stripe test card que falha
  - Verificar `payment_status = 'payment_failed'`

**Deliverables Fase 2**:
- ✅ Webhook handler deployado e funcionando
- ✅ CORS restrito a origens conhecidas
- ✅ Webhook configurado no Stripe (test + production)
- ✅ Produtos Stripe verificados
- ✅ Sincronização automática testada

### FASE 3: Segurança Avançada & Correção de Vulnerabilidades (Dias 7-9)
**Objetivo**: CSP, logging estruturado, corrigir bypasses de quota, ativar rate limiting

**Tarefas Detalhadas:**

#### 3.1 Adicionar Content Security Policy no Vercel (Dia 7, 3h)
- **Arquivo**: `vercel.json`
- **Adicionar header**:
  ```json
  {
    "key": "Content-Security-Policy",
    "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com; frame-src https://js.stripe.com https://checkout.stripe.com; img-src 'self' data: https:;"
  }
  ```
- **Adicionar HSTS**:
  ```json
  {
    "key": "Strict-Transport-Security",
    "value": "max-age=31536000; includeSubDomains; preload"
  }
  ```
- **Teste**: Deploy em preview, verificar tudo funciona, ajustar CSP se necessário
- **Status**: CONCLUIDO - CSP e HSTS adicionados em `vercel.json`. Teste pendente

#### 3.2 Implementar Logging Estruturado (Dia 7, 3h)
- **Criar**: `src/lib/logger.ts` com interface de log estruturado
- **Funcionalidade**: `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()`
- **Condicional**: Só logar debug em desenvolvimento (`import.meta.env.DEV`)
- **Arquivos para modificar** (substituir console.log/error):
  - `src/hooks/useSubscription.tsx`
  - `src/pages/Dashboard.tsx`
  - `src/pages/Plans.tsx`
  - `src/pages/Auth.tsx`
  - Edge Functions (todos)
- **Teste**: Verificar logs em dev, confirmar ausência em produção
- **Status**: CONCLUIDO - `src/lib/logger.ts` criado e console substituído em hooks/páginas/edge functions. Teste pendente

#### 3.3 Corrigir Bypass de Quota via incrementUsage (Dia 8, 3h)
- **Problema**: Se `incrementUsage()` falhar, usuário recebe arquivo sem contar na cota
- **Arquivo**: `src/pages/Dashboard.tsx` linhas 223-237
- **Mudança**: Bloquear download se incremento falhar
  ```typescript
  const usageResult = await incrementUsage();
  if (!usageResult.success) {
    logger.error('Failed to increment usage', undefined, { userId: user.id });
    toast.error('Erro crítico', {
      description: 'Não foi possível registrar o uso. Entre em contato.'
    });
    return; // Bloquear download
  }
  ```
- **Criar**: Tabela `pending_usage` para reconciliação manual (migration opcional)
- **Teste**: Simular falha do banco, verificar que download é bloqueado
- **Status**: CONCLUIDO - bloqueio de download quando incrementUsage falha implementado em `src/pages/Dashboard.tsx`. Teste pendente

#### 3.4 Não Contar Arquivos Sem VBA (Dia 8, 3h)
- **Problema**: Arquivos sem VBA contam na cota, mas nada é modificado
- **Arquivo**: `src/lib/excel-vba-modifier.ts`
- **Adicionar campo**: `shouldCountUsage: boolean` no retorno
- **Lógica**: `shouldCountUsage = true` apenas se padrões foram modificados
- **Arquivo**: `src/pages/Dashboard.tsx`
- **Mudança**: Só chamar `incrementUsage()` se `shouldCountUsage === true`
- **Teste**: Upload arquivo sem VBA, verificar cota não diminui
- **Status**: CONCLUIDO - `shouldCountUsage` adicionado e uso só incrementa quando padrões são modificados. Teste pendente

#### 3.5 Ativar Rate Limiting (Dia 9, 4h)
- **Problema**: Infraestrutura existe mas não é usada
- **Arquivo**: `src/hooks/useAuth.tsx`
- **Adicionar antes de signIn/signUp**:
  ```typescript
  await supabase.rpc('check_rate_limit', {
    user_ip: await getUserIP(),
    attempt_type: 'login',
    max_attempts: 5,
    window_minutes: 15
  });
  ```
- **Criar**: `src/lib/ip.ts` com função `getUserIP()` (usar api.ipify.org)
- **Adicionar após tentativa**:
  ```typescript
  await supabase.rpc('log_auth_attempt', {
    user_ip, user_email, attempt_type, was_successful, user_agent_string
  });
  ```
- **Teste**: Fazer 5 logins errados, verificar bloqueio no 6º
- **Status**: CONCLUIDO - rate limiting integrado em `src/hooks/useAuth.tsx` e helper `src/lib/ip.ts` criado. Teste pendente

#### 3.6 Remover console.log de Produção (Dia 9, 2h)
- **Busca**: Grep por `console.log` e `console.error`
- **Substituir**: Por chamadas do logger criado em 3.2
- **Verificar**: Nenhum console.log permanece no build de produção
- **Teste**: `npm run build`, verificar sem console logs
- **Status**: CONCLUIDO - console substituído por logger nos pontos identificados. Teste pendente

**Deliverables Fase 3**:
- ✅ CSP e HSTS configurados
- ✅ Logging estruturado implementado
- ✅ Bypass de quota corrigido
- ✅ Arquivos sem VBA não contam
- ✅ Rate limiting ativo
- ✅ Console logs removidos

### FASE 4: TypeScript Strictness & Qualidade de Código (Dias 10-11)
**Objetivo**: Tornar o código mais robusto, remover código duplicado, endurecer TypeScript

**Tarefas Detalhadas:**

#### 4.1 Habilitar TypeScript Strict Mode Gradualmente (Dia 10, 6h)
- **Arquivo**: `tsconfig.json`
- **Estratégia**: Habilitar uma flag por vez, corrigir erros, commit
- **Ordem**:
  1. `noImplicitAny: true` (espera 10-15 erros)
  2. `strictNullChecks: true` (espera 20-30 erros)
  3. `noUnusedLocals: true` e `noUnusedParameters: true`
  4. `strict: true` (habilita todos)
- **Script**: Adicionar ao package.json: `"type-check": "tsc --noEmit"`
- **Teste**: `npm run type-check` sem erros
- **Status**: CONCLUIDO - strict mode habilitado (noImplicitAny, strictNullChecks, noUnused*, strict) e script `type-check` adicionado

#### 4.2 Remover Componente Duplicado (Dia 10, 1h)
- **Deletar**: `src/components/ExcelBlocker.tsx` (não usado)
- **Verificar**: `grep -r "ExcelBlocker" src/` retorna vazio
- **Teste**: Build sem erros
- **Status**: CONCLUIDO - `src/components/ExcelBlocker.tsx` removido

#### 4.3 Limpar Código e Documentar (Dia 11, 4h)
- **Tarefas**:
  - Rodar `npm run lint`, corrigir todos warnings
  - Adicionar JSDoc em funções complexas:
    - `src/lib/excel-vba-modifier.ts` - `modifyVbaContent()`
    - `src/hooks/useSubscription.tsx` - `getWeekNumber()`
  - Remover imports não usados
  - Remover variáveis/funções não usadas
- **Teste**: Lint sem warnings, build limpo
- **Status**: CONCLUIDO - lint limpo, imports/vars ajustados e JSDoc adicionado

**Deliverables Fase 4**:
- ✅ TypeScript strict mode ativado
- ✅ Todos erros de tipo corrigidos
- ✅ Código duplicado removido
- ✅ Lint sem warnings
- ✅ Funções complexas documentadas

### FASE 5: Testes Automatizados (Dias 12-13)
**Objetivo**: Testar lógica crítica de negócio com testes essenciais

**Tarefas Detalhadas:**

#### 5.1 Configurar Vitest (Dia 12, 2h)
- **Instalar**: `npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom`
- **Criar**: `vitest.config.ts` com configuração
- **Criar**: `src/test/setup.ts` com setup do testing library
- **Atualizar**: `package.json` com scripts:
  - `"test": "vitest"`
  - `"test:ui": "vitest --ui"`
- **Teste**: `npm test` roda sem erros (mesmo sem testes ainda)
- **Status**: CONCLUIDO - Vitest configurado, setup criado e scripts adicionados; `npm test -- --run` passou

#### 5.2 Testes para Excel Processing (Dia 12, 4h)
- **Criar**: `src/lib/excel-vba-modifier.test.ts`
- **Casos de teste**:
  - ✅ Rejeitar arquivos não-.xlsm
  - ✅ Arquivo .xlsm válido com VBA patterns
  - ✅ Arquivo .xlsm sem VBA project
  - ✅ Arquivo vazio
  - ✅ ZIP corrompido
  - ✅ VBA sem patterns de proteção
  - ✅ Múltiplos patterns (CMG, DPB, GC)
  - ✅ Pattern na posição de boundary (edge case)
- **Teste**: `npm test` - todos casos passam
- **Status**: CONCLUIDO - testes de Excel implementados e passando

#### 5.3 Testes para Subscription Logic (Dia 13, 5h)
- **Criar**: `src/hooks/useSubscription.test.ts`
- **Casos de teste**:
  - ✅ Contagem semanal dentro da mesma semana ISO
  - ✅ Reset semanal ao cruzar semana ISO
  - ✅ Contagem mensal dentro do mesmo mês
  - ✅ Reset mensal ao cruzar mês
  - ✅ Week number em boundary de ano (31 Dez → 1 Jan)
  - ✅ getLocalDateString não sofre de timezone issues
  - ✅ Limit enforcement (file size, weekly, monthly)
- **Teste crucial** (bug que corrigimos):
  ```typescript
  it('should reset usage when crossing ISO week', () => {
    const lastDate = '2025-12-21'; // Domingo
    const today = '2025-12-22'; // Segunda, nova semana
    // Deve resetar contador
  });
  ```
- **Teste**: Cobertura >80% em useSubscription
- **Status**: CONCLUIDO PARCIAL - testes implementados e passando; cobertura ainda não medida

**Deliverables Fase 5**:
- ✅ Vitest configurado e rodando
- ✅ Excel processing testado (8+ casos)
- ✅ Subscription logic testada (7+ casos)
- ✅ Cobertura >80% em código crítico
- ✅ Todos testes passando no CI
- **Status**: CONCLUIDO PARCIAL - testes locais passando; cobertura e CI pendentes

### FASE 6: CI/CD & Deploy para Produção (Dias 14-16)
**Objetivo**: Automação de build/teste, deploy em produção, monitoramento básico

**Tarefas Detalhadas:**

#### 6.1 Configurar GitHub Actions (Dia 14, 3h)
- **Criar**: `.github/workflows/ci.yml`
- **Jobs**:
  - Install dependencies
  - Run lint (`npm run lint`)
  - Run type check (`npm run type-check`)
  - Run tests (`npm test`)
  - Build (`npm run build`)
  - Upload artifacts
- **Trigger**: Push para `main` e pull requests
- **Teste**: Fazer commit, verificar workflow passa
- **Status**: CONCLUIDO - workflow criado em `.github/workflows/ci.yml`

#### 6.2 Configurar Variáveis de Ambiente (Dia 14, 2h)
- **Vercel Production**:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_PROJECT_ID`
- **Supabase Secrets** (production):
  - `STRIPE_SECRET_KEY` (live key, não test)
  - `STRIPE_WEBHOOK_SECRET` (do webhook de produção)
  - `SERVICE_ROLE_KEY`
- **Atualizar**: `.env.example` com todas vars documentadas
- **Status**: CONCLUIDO (usuario) - Vercel e Supabase secrets configurados

#### 6.3 Checklist Pré-Deploy (Dia 15, 4h)
**Segurança**:
- [ ] JWT verification ativo em Edge Functions
- [ ] CORS restrito a domínios de produção
- [ ] CSP e HSTS headers configurados
- [ ] Rate limiting funcionando
- [ ] Stripe webhook secret configurado
- [ ] Sem secrets hardcoded no código

**Funcionalidade**:
- [ ] Build sem erros
- [ ] Todos testes passando
- [ ] Type check sem erros
- [ ] Lint sem warnings
- [ ] Teste manual completo:
  - [ ] Signup/login
  - [ ] Processar arquivo (free plan)
  - [ ] Checkout Stripe (professional)
  - [ ] Checkout Stripe (premium)
  - [ ] Quota enforcement
  - [ ] Webhook handler (test mode)
  - [ ] Customer portal

**Performance**:
- [ ] Bundle size < 500KB
- [ ] Lighthouse score > 90
- [ ] First Contentful Paint < 2s

**Dados**:
- [ ] Migrations aplicadas
- [ ] Backup strategy documentada
- **Status**: PENDENTE (usuario)

#### 6.4 Deploy Gradual (Dias 15-16)
**Preview (Dia 15 manhã)**:
- Deploy em Vercel preview
- Teste manual completo
- Convidar 2-3 beta users
- Monitorar por 4 horas

**Production (Dia 15 tarde)**:
- Deploy em produção via Vercel
- Trocar Stripe para modo production
- Configurar webhook de produção
- Monitorar error rates

**Estabilização (Dia 16)**:
- Monitorar por 48 horas
- Verificar logs de erro
- Testar fluxo real de pagamento
- **Status**: PENDENTE (usuario)
- Estar pronto para rollback se necessário

#### 6.5 Monitoramento Básico (Dia 16, 3h)
**Sem Sentry** (conforme sua escolha):
- **Criar**: `src/lib/error-tracker.ts` com sistema próprio
- **Migration**: Tabela `error_logs` no Supabase
- **Integrar**: Event listeners para `error` e `unhandledrejection`
- **Dashboard**: Monitorar via Vercel Analytics e Supabase Dashboard
- **Alertas**: Configurar no Supabase:
  - Database CPU > 80%
  - Edge Function error rate > 5%
  - Auth failures > 10/min
- **Status**: CONCLUIDO PARCIAL - error-tracker e migration adicionados; alertas no Supabase pendentes (usuario)

**Deliverables Fase 6**:
- **Status**: EM ANDAMENTO - CI criado, .env.example atualizado, error-tracker adicionado; configuracoes/deploy pendentes (usuario)
- ✅ CI/CD rodando no GitHub Actions
- ✅ Env vars configuradas (prod + test)
- ✅ Deploy em produção concluído
- ✅ Monitoramento básico ativo
- ✅ 48h de estabilidade confirmada

### FASE 7: Documentação & Handoff (Dias 17-18)
**Objetivo**: Documentar tudo, criar runbooks, preparar para manutenção contínua

**Tarefas Detalhadas:**

#### 7.1 Atualizar Documentação (Dia 17, 4h)
- **Atualizar**: `README.md` com instruções de deploy
- **Atualizar**: `CLAUDE.md` com arquitetura atualizada:
  - Stripe IDs no banco
  - Weekly counting corrigido
  - Webhook handler
  - Monitoramento
- **Criar**: `DEPLOYMENT.md` com guia completo de deploy
- **Criar**: `RUNBOOK.md` com troubleshooting comum
- **Status**: CONCLUIDO - `README.md`, `CLAUDE.md`, `DEPLOYMENT.md`, `RUNBOOK.md` atualizados/criados

#### 7.2 Criar Sitemap e Otimizar SEO (Dia 17, 2h)
- **Criar**: `public/sitemap.xml`
- **Páginas**: `/`, `/dashboard`, `/plans`, `/auth`
- **Atualizar**: `public/robots.txt` com referência ao sitemap
- **Verificar**: Meta tags em `index.html`
- **Status**: CONCLUIDO - sitemap criado e robots atualizado; meta tags revisadas (dominio: https://vbablocker.vercel.app/)

#### 7.3 Estratégia de Backup (Dia 18, 2h)
- **Supabase**: Backups automáticos diários (já habilitado)
- **Criar**: Script `backup.sh` para backup manual
- **Documentar**: Procedimento de restore
- **Agendar**: Backups semanais adicionais (via GitHub Actions)
- **Status**: CONCLUIDO PARCIAL - `backup.sh` e workflow semanal criados; secret `SUPABASE_DB_URL` pendente (usuario)

#### 7.4 Performance Baseline (Dia 18, 2h)
- **Medir e documentar**:
  - Page load time
  - Time to Interactive
  - Bundle size
  - Database query latency
  - Edge Function cold start
- **Ferramentas**: Lighthouse CI, Vercel Analytics, Supabase Dashboard
- **Documentar**: Baseline para comparação futura
- **Status**: CONCLUIDO PARCIAL - template criado em `PERFORMANCE_BASELINE.md`; medicoes pendentes (usuario)

**Deliverables Fase 7**:
- **Status**: EM ANDAMENTO - docs/SEO concluidos; backup secrets e baseline pendentes (usuario)
- ✅ Toda documentação atualizada
- ✅ Runbook de troubleshooting criado
- ✅ Sitemap e SEO otimizados
- ✅ Estratégia de backup documentada
- ✅ Performance baseline registrada
- ✅ Projeto pronto para handoff

---


## GUIA PASSO A PASSO PARA TAREFAS PENDENTES (USUARIO)

### 1) Definir dominio oficial e atualizar SEO (sitemap/robots)
- 1) Confirme o dominio final do site (ex.: `https://vbablocker.vercel.app`).
- 2) Se o dominio mudar, edite `public/sitemap.xml` e substitua todas as URLs em `<loc>`.
- 3) Atualize `public/robots.txt` com o novo sitemap na linha `Sitemap:`.
- 4) Salve e faca commit das mudancas.

### 2) Configurar variaveis no Vercel (frontend)
- 1) Acesse https://vercel.com/dashboard e abra o projeto `vbablocker`.
- 2) No menu do projeto, clique em `Settings`.
- 3) No menu lateral, abra `Environment Variables`.
- 4) Clique em `Add` e preencha cada variavel abaixo (marque `Production` e `Preview`):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY` (chave anon/publica)
  - `VITE_SUPABASE_PROJECT_ID`
- 5) Onde pegar os valores no Supabase:
  - Supabase Dashboard -> seu projeto.
  - Menu lateral (parte de baixo) -> `Project Settings` (icone de engrenagem).
  - Clique em `API`.
  - Copie:
    - `Project URL` -> vira `VITE_SUPABASE_URL`
    - `anon public` key -> vira `VITE_SUPABASE_PUBLISHABLE_KEY`
    - `Project ID` (aparece no topo ou no URL do projeto) -> vira `VITE_SUPABASE_PROJECT_ID`
- 6) Obs: use a chave `anon public` (nao use `Publishable key (default)` ou `Secret key (default)`).
- 7) Depois de adicionar as 3 variaveis, clique em `Save`.
- 8) Va em `Deployments`, clique no ultimo deploy e escolha `Redeploy`.

### 3) Configurar secrets no Supabase (Edge Functions)
- 1) Supabase -> `Project Settings` -> `Edge Functions` -> `Secrets`.
- 2) Adicione:
  - `STRIPE_SECRET_KEY` (use `sk_test_...` para testes ou `sk_live_...` para producao)
  - `STRIPE_WEBHOOK_SECRET` (obtido no Stripe, passo 6)
  - `SERVICE_ROLE_KEY` (Supabase -> `Project Settings` -> `API`)
- 3) Obs: o Supabase nao aceita secrets com prefixo `SUPABASE_`.
- 4) Salve as secrets.
- **Status**: CONCLUIDO (usuario) - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e `SERVICE_ROLE_KEY` configuradas

### 4) Aplicar migrations no Supabase
- **Status**: CONCLUIDO (usuario) - migrations base, rate limiting e fixes aplicadas
- 1) Supabase -> `SQL Editor` -> `New query`.
- 2) Abra cada arquivo abaixo e execute o SQL:
  - `supabase/migrations/20251222_fix_weekly_counting.sql`
  - `supabase/migrations/20251222_add_stripe_ids.sql`
  - `supabase/migrations/20251222_error_logging.sql`
- 2b) Se aparecer erro "relation "subscriptions" does not exist", execute antes:
  - `supabase/migrations/20251208120034_2a6da247-0e82-4cc3-89c2-a6b8c1870ea9.sql`
  - `supabase/migrations/20251210_add_rate_limiting.sql`
- 3) Verifique no `Table Editor`:
  - `subscriptions` tem `sheets_used_week` e `stripe_*`
  - Tabela `error_logs` existe

### 5) Deploy das Edge Functions
- 1) Instale o CLI do Supabase (uma vez):
  ```bash
  npm install -g supabase
  ```
- 2) Login:
  ```bash
  supabase login
  ```
- 3) Link do projeto:
  ```bash
  supabase link --project-ref <seu-project-ref>
  ```
- 4) Deploy das funcoes:
  ```bash
  supabase functions deploy create-checkout
  supabase functions deploy check-subscription
  supabase functions deploy customer-portal
  supabase functions deploy stripe-webhook
  ```

- **Status**: CONCLUIDO (usuario) - redeploy realizado
### 6) Configurar webhook no Stripe
- 1) Stripe Dashboard -> `Developers` -> `Webhooks` -> `Add endpoint`.
- 2) URL:
  `https://dgweztejbixowxmfizgx.supabase.co/functions/v1/stripe-webhook`
- 3) Selecione eventos:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- 4) Copie o `Signing Secret` (`whsec_...`).
- 5) Volte ao Supabase e salve em `STRIPE_WEBHOOK_SECRET`.
- 6) Envie um evento de teste no Stripe e verifique logs no Supabase.

### 7) Verificar produtos e precos no Stripe
- 1) Stripe Dashboard -> `Products`.
- 2) Compare IDs e precos com `src/lib/stripe.ts`.
- 3) Se estiver diferente, atualize `src/lib/stripe.ts`, faca commit e redeploy.

### 8) Configurar alertas no Supabase
- 1) Supabase -> `Alerts` (ou `Settings` -> `Alerts`).
- 2) Crie alertas:
  - Database CPU > 80%
  - Edge Function error rate > 5%
  - Auth failures > 10/min
- 3) Defina o canal (email/Slack).

### 9) Ativar backup semanal no GitHub
- 1) Supabase -> `Project Settings` -> `Database` -> copie a connection string (URI).
- 2) GitHub -> repo -> `Settings` -> `Secrets and variables` -> `Actions`.
- 3) Crie secret `SUPABASE_DB_URL` com a URI.
- 4) Rode manualmente o workflow `Weekly Backup` para testar.

### 10) Preencher baseline de performance
- 1) Abra `PERFORMANCE_BASELINE.md`.
- 2) Rode Lighthouse no Chrome (DevTools -> Lighthouse).
- 3) Preencha scores e tempos (FCP/TTI).
- 4) Rode `npm run build` e anote o tamanho de `dist/`.
- 5) No Supabase, anote latencias p95.

### 11) Rodar testes e checklist final
- 1) No terminal (raiz do projeto):
  ```bash
  npm run lint
  npm run type-check
  npm test -- --run
  npm run build
  ```
- 2) Teste manual:
  - Signup/login
  - Processar arquivo (free)
  - Checkout Stripe (professional/premium)
  - Cancelamento no portal
  - Webhook atualiza plano
  - Rate limiting
  - Error logs em `error_logs`

### 12) Deploy e monitoramento
- 1) Faca deploy preview no Vercel e execute o checklist.
- 2) Faca deploy em producao.
- 3) Monitore por 48 horas (erros, pagamentos, logs).

## 🗂️ ARQUIVOS CRÍTICOS A MODIFICAR

### NOVOS Arquivos a Criar:
1. `supabase/functions/stripe-webhook/index.ts` - Webhook handler
2. `supabase/migrations/YYYYMMDD_fix_weekly_counting.sql` - Adicionar sheets_used_week
3. `supabase/migrations/YYYYMMDD_add_stripe_ids.sql` - Campos Stripe
4. `supabase/migrations/YYYYMMDD_error_logging.sql` - Tabela error_logs
5. `src/lib/logger.ts` - Sistema de logging estruturado
6. `src/lib/ip.ts` - Helper para getUserIP()
7. `src/lib/error-tracker.ts` - Rastreamento de erros
8. `src/lib/excel-vba-modifier.test.ts` - Testes Excel
9. `src/hooks/useSubscription.test.ts` - Testes subscription
10. `vitest.config.ts` - Configuração de testes
11. `src/test/setup.ts` - Setup do testing library
12. `.github/workflows/ci.yml` - Pipeline CI/CD
13. `DEPLOYMENT.md` - Guia de deploy
14. `RUNBOOK.md` - Troubleshooting
15. `public/sitemap.xml` - SEO
16. `backup.sh` - Script de backup manual
17. `.github/workflows/weekly-backup.yml` - Backup semanal
18. `PERFORMANCE_BASELINE.md` - Baseline de performance

### Arquivos a MODIFICAR:
**Fase 1 (Dias 1-3)**:
- `vite.config.ts` - Corrigir build failure
- `supabase/config.toml` - JWT verification
- `src/hooks/useSubscription.tsx` - Bug semanal (linha 131)
- `src/integrations/supabase/types.ts` - Novos campos
- `supabase/functions/create-checkout/index.ts` - Salvar Stripe IDs
- `supabase/functions/check-subscription/index.ts` - Salvar Stripe IDs

**Fase 2 (Dias 4-6)**:
- Todas Edge Functions - Restringir CORS
- `supabase/config.toml` - Adicionar stripe-webhook config

**Fase 3 (Dias 7-9)**:
- `vercel.json` - CSP + HSTS headers
- `src/pages/Dashboard.tsx` - Bypass quota, logging
- `src/lib/excel-vba-modifier.ts` - Campo shouldCountUsage
- `src/hooks/useAuth.tsx` - Rate limiting
- `src/pages/Auth.tsx` - Logging
- `src/pages/Plans.tsx` - Logging
- Todas Edge Functions - Substituir console.log

**Fase 4 (Dias 10-11)**:
- `tsconfig.json` - Strict mode
- `package.json` - Scripts test + type-check
- DELETE: `src/components/ExcelBlocker.tsx`

**Fase 5 (Dias 12-13)**:
- `package.json` - Dependências de teste

**Fase 6 (Dias 14-16)**:
- `.env.example` - Documentar todas vars

**Fase 7 (Dias 17-18)**:
- `README.md` - Atualizar
- `CLAUDE.md` - Atualizar arquitetura
- `public/robots.txt` - Adicionar sitemap

---

## 📊 TIMELINE RESUMIDA

| Fase | Dias | Foco Principal | Status ao Final |
|------|------|----------------|-----------------|
| **Fase 1** | 1-3 | Build + Segurança + Bug Semanal | Sistema deployável |
| **Fase 2** | 4-6 | Stripe Webhooks + CORS | Pagamentos automáticos |
| **Fase 3** | 7-9 | CSP + Logging + Vulnerabilidades | Sistema seguro |
| **Fase 4** | 10-11 | TypeScript + Qualidade | Código robusto |
| **Fase 5** | 12-13 | Testes Automatizados | Lógica validada |
| **Fase 6** | 14-16 | CI/CD + Deploy + Monitoramento | Em produção |
| **Fase 7** | 17-18 | Documentação + Handoff | Enterprise-ready |

**Total**: 18 dias úteis + 2-3 dias buffer = **2.5-3 semanas**

---

## 🎬 COMO COMEÇAR A IMPLEMENTAÇÃO

### Pré-requisitos:
1. **Verificar Produtos Stripe**: Antes de começar, confirmar que os IDs de produto no código correspondem aos produtos reais no Stripe Dashboard
2. **Backup do Banco**: Fazer backup completo do Supabase antes de qualquer migration
3. **Branch de Trabalho**: Criar branch `production-readiness` para todo trabalho
4. **Ambiente de Teste**: Configurar ambiente de staging no Vercel para testes

### Ordem de Execução:
1. **Começar pela Fase 1** - Resolver problemas bloqueadores primeiro
2. **Testar cada fase** - Não avançar sem testar deliverables
3. **Commit frequente** - Fazer commits pequenos após cada tarefa
4. **Deploy incremental** - Testar em preview antes de produção

### Checklist de Início:
- [ ] Ler este plano completamente
- [ ] Verificar produtos Stripe (Fase 2.4)
- [ ] Fazer backup do banco de dados
- [ ] Criar branch `production-readiness`
- [ ] Configurar preview environment no Vercel
- [ ] Começar Fase 1, Tarefa 1.1

---

## 📋 RESUMO FINAL

**Problemas Encontrados**: 22 issues (7 críticos, 15 alta prioridade)
**Tempo de Implementação**: 18 dias úteis (2.5-3 semanas)
**Arquivos Novos**: 15 arquivos a criar
**Arquivos a Modificar**: ~25 arquivos
**Migrations**: 3 database migrations
**Testes**: 15+ test cases

**Resultado Final**: Sistema enterprise-grade, seguro, testado, monitorado e pronto para escalar 🚀
