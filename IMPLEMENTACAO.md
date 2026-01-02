# Plano de Implementacao - Liberacao para Venda (SaaS Self-Serve)

Objetivo
- Corrigir gaps tecnicos/comerciais e liberar cobranca com seguranca.
- Garantir limites por plano, integridade do billing e conformidade minima LGPD.

Premissas e Dependencias
- Dominio final e dominio de staging definidos.
- IDs Stripe (produtos/precos) de test e live disponiveis.
- Supabase staging e prod separados.
- Responsavel legal e canal de suporte definidos.

Escopo (P0 para venda)
- Billing, entitlements e limites server-side.
- RLS/seguranca de dados.
- Deploy/observabilidade/backup.
- Politicas legais e onboarding minimo.

Nao fazer agora
- Features novas (API publica, batch, times/assentos).
- Reescrita de UI/UX completa.

Fases e Timeline (2-4 semanas)

Semana 1 (P0 - Receita e Seguranca)
1) Entitlements e quotas no backend
   - Acao: exigir processingToken no process-file e consumir no server.
   - Onde mexer: supabase/functions/process-file/index.ts, supabase/functions/validate-processing/index.ts
   - Como validar: chamada direta ao process-file sem token deve falhar.
   - Pronto: quotas nao podem ser burladas por chamada direta.

2) RLS/antifraude em subscriptions
   - Acao: bloquear update de plan/payment_status/stripe_* pelo cliente.
   - Onde mexer: supabase/migrations/* (policies, triggers, views)
   - Como validar: update direto via client retorna 403.
   - Pronto: somente service role altera campos sensiveis.

3) Payment failed bloqueia uso
   - Acao: considerar payment_status no validate-processing.
   - Onde mexer: supabase/functions/validate-processing/index.ts, stripe-webhook/index.ts
   - Como validar: evento invoice.payment_failed bloqueia processamento.
   - Pronto: usuario inadimplente nao processa.

Semana 2 (P0 - Stripe e Legal)
4) Centralizar IDs do Stripe
   - Acao: remover hard-coded; usar env/DB.
   - Onde mexer: supabase/functions/create-checkout/index.ts, check-subscription/index.ts,
     stripe-webhook/index.ts, src/config/plans.ts
   - Como validar: troca de IDs via env funciona sem code change.
   - Pronto: zero IDs hard-coded.

5) Politicas e LGPD alinhadas ao fluxo real
   - Acao: corrigir Privacy/Terms e arquitetura (processamento via Edge).
   - Onde mexer: src/pages/Privacy.tsx, src/pages/Terms.tsx, docs/ARCHITECTURE.md, README.md
   - Como validar: revisao juridica e texto final sem "rascunho".
   - Pronto: comunicacao consistente e legalmente revisada.

Semana 3 (P1 - Operacao)
6) Staging/prod isolados
   - Acao: criar projetos separados Supabase/Vercel e variaveis por ambiente.
   - Onde mexer: Vercel, Supabase, .env.staging.example
   - Como validar: URLs e chaves diferentes, dados isolados.
   - Pronto: staging nao impacta prod.

7) Observabilidade e alertas
   - Acao: ativar Sentry (frontend) e uptime monitor.
   - Onde mexer: src/lib/sentry.ts, docs/SENTRY_ALERTS.md, docs/UPTIME_MONITORING.md
   - Como validar: erro de teste aparece no Sentry.
   - Pronto: alertas ativos com thresholds.

Semana 4 (P1 - Comercial)
8) Plano anual persistido
   - Acao: adicionar billing_period ou plan_variant no DB.
   - Onde mexer: supabase/migrations/*, src/lib/types/subscription.ts, src/config/plans.ts
   - Como validar: compra anual aparece como anual na UI.
   - Pronto: plano anual consistente no backend.

9) Onboarding minimo e suporte
   - Acao: checklist de primeiro sucesso (3-5 min) e contato de suporte.
   - Onde mexer: src/pages/Dashboard.tsx, src/pages/Faq.tsx, src/components/NewHeader.tsx
   - Como validar: novo usuario completa fluxo sem suporte.
   - Pronto: onboarding e canal de suporte visiveis.

Detalhamento tecnico por item (subtarefas)

1) Entitlements e quotas no backend
- Adicionar campo processingToken no request do process-file (body ou header).
- No process-file, validar token em processing_tokens:
  - SELECT token por user_id + token + expires_at.
  - Falha se expired/used/null.
  - UPDATE used_at atomico ao iniciar processamento.
- Bloquear se payment_status != "active" (ver item 3).
- Frontend: enviar processingToken no invokeProcessFile (src/pages/Dashboard.tsx).
- Validar: chamada manual ao endpoint sem token retorna 401/403 e nao processa.

2) RLS/antifraude em subscriptions
- Remover policy de UPDATE aberta para authenticated na tabela subscriptions.
- Criar RPC security definer para atualizacao de uso (incremento de counters).
- Criar RPC security definer para mudar plano para "free" (quando usuario cancela).
- Garantir que somente service role atualiza plan/payment_status/stripe_*.
- Validar: update direto via client em subscriptions retorna 403.

3) Payment failed bloqueia uso
- validate-processing deve ler payment_status e bloquear quando:
  - plan != "free" e payment_status in ("payment_failed", "past_due", "unpaid").
  - opcional: permitir se cancel_at_period_end == true e now < current_period_end.
- stripe-webhook deve setar payment_status corretamente:
  - invoice.payment_failed -> "payment_failed"
  - customer.subscription.updated -> "active" quando status active/trialing
  - customer.subscription.deleted -> "pending"
- Validar: disparar evento invoice.payment_failed e tentar processar.

4) Centralizar IDs do Stripe
- Substituir IDs hard-coded em create-checkout/check-subscription/stripe-webhook por:
  - ENV: STRIPE_PROFESSIONAL_PRODUCT_ID, STRIPE_PREMIUM_PRODUCT_ID, STRIPE_ANNUAL_PRICE_ID
  - ou tabela public.stripe_price_map (plan, product_id, price_id).
- Garantir que o frontend leia apenas IDs publicos via env (VITE_STRIPE_*).
- Validar: trocar IDs via env sem mudar codigo.

5) Politicas e LGPD alinhadas ao fluxo real
- Atualizar Privacy/Terms para indicar processamento via Edge Function (sem storage).
- Informar coleta de IP (ipify) e finalidade (rate limiting).
- Definir base legal, direitos do titular e contato do controlador/DPO.
- Validar: revisao juridica e textos finais publicados.

6) Staging/prod isolados
- Criar projetos separados no Supabase e Vercel.
- Ajustar auth redirects e allowed origins por ambiente.
- Atualizar .env.staging.example com todos os secrets obrigatorios.
- Validar: login e checkout funcionando em staging sem tocar prod.

7) Observabilidade e alertas
- Ativar Sentry via VITE_SENTRY_DSN e configurar alertas (docs/SENTRY_ALERTS.md).
- Configurar uptime monitor com health-check protegido por ADMIN_SECRET.
- Definir retenção para error_logs (SQL job mensal ou cron).
- Validar: erro de teste chega no Sentry e alerta dispara.

8) Plano anual persistido
- Adicionar coluna subscriptions.billing_period ("month" | "year") ou plan_variant.
- Atualizar stripe-webhook para preencher billing_period baseado no price_id.
- UI: mapear "premium"+"year" -> "anual" para display.
- Validar: compra anual reflete corretamente no Account/Plans.

9) Onboarding minimo e suporte
- Criar checklist curto no Dashboard (upload -> processar -> download).
- Adicionar email de suporte e link de termos/privacidade no header/footer.
- Validar: usuario novo conclui em 3-5 min sem suporte.

Contratos de webhook Stripe (minimo)
- Endpoint: /functions/v1/stripe-webhook
- Eventos obrigatorios:
  - checkout.session.completed
  - customer.subscription.created
  - customer.subscription.updated
  - customer.subscription.deleted
  - invoice.payment_failed
- Idempotencia: stripe_webhook_events com unique(event_id).
- Campos esperados:
  - customer, subscription, price.product, current_period_end, cancel_at_period_end
- Validar: reenvio do mesmo event_id nao duplica atualizacao.

Migrations sugeridas (resumo)
- subscriptions: add billing_period, current_period_end, cancel_at_period_end (se ainda faltar).
- RLS: remover UPDATE policy aberta em subscriptions.
- RPCs: update_subscription_usage, set_free_plan.
- Retencao: rotina para limpar error_logs (90 dias).

Backlog Detalhado por Workstream

Billing/Entitlements (P0)
- Token obrigatorio no process-file.
- Validar payment_status no validate-processing.
- Mapear priceId -> plan via env/DB.
- Webhooks: garantir eventos minimos (checkout completed, subscription updated/deleted, invoice payment_failed).
- Emails transacionais (upgrade/failed/cancel).

Seguranca/LGPD (P0)
- RLS restritiva em subscriptions.
- Revisar claims de processamento local vs Edge.
- Avaliar coleta de IP (ipify) e CSP/consentimento.

DevOps/SRE (P1)
- Pipeline de deploy (staging/prod) com rollback.
- Teste de restore e registro em docs/BACKUP_TEST_LOG.md.
- Uptime monitor + alertas.

Produto/Growth (P1)
- Mensagem principal + 3 bullets de valor na landing.
- Pricing e limites sincronizados frontend/backend.
- Trial/freemium e gatilho de upgrade no limite.

QA/Testing (P1)
- E2E sem skips (E2E_EMAIL/PASSWORD).
- Testes de abuso (chamada direta process-file, token replay).
- Smoke tests pre-deploy (staging/prod).

Checklist de Release (Go/No-Go)
- build/lint/type-check/unit OK.
- e2e OK (sem skips).
- Webhook Stripe confirmado em staging e prod.
- Politicas LGPD/Termos revisadas.
- Uptime + Sentry ativos.
- Backup restore testado.

Riscos e Mitigacoes
- Bypass de limites -> token obrigatorio + consumo server-side.
- Fraude de plano -> RLS + triggers + service role only.
- Inadimplencia -> bloquear uso em payment_failed.
- Divergencia legal -> alinhar docs/politicas com fluxo real.

Perguntas Abertas (bloqueadoras)
- Qual dominio final e staging?
- IDs definitivos do Stripe (live)?
- Qual politica de dunning/chargeback (grace period)?
- Quem e o DPO/controlador e email de suporte?
