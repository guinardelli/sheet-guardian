# Issues - Plano de Implementacao (SaaS Self-Serve)

Como usar
- Cada item abaixo pode virar uma issue.
- "Owner" pode ser ajustado por pessoa/time.
- "Ready" define criterio de pronto objetivo.

SG-001 - Entitlements: token obrigatorio no process-file
Priority: P0
Owner: Tech Lead
Effort: M
Depends on: SG-002
Scope:
- Exigir processingToken no endpoint process-file.
- Validar token (exists, not expired, not used) e marcar used_at.
- Bloquear processamento sem token.
Checklist:
- process-file valida token e retorna 401/403 sem token.
- token e consumido de forma atomica antes do processamento.
- chamada direta ao endpoint falha sem token valido.
Files:
- supabase/functions/process-file/index.ts
- supabase/functions/validate-processing/index.ts
Ready:
- 3 testes manuais: sem token, token expirado, token valido.

SG-002 - RLS: bloquear update sensivel em subscriptions
Priority: P0
Owner: Security
Effort: M
Depends on: none
Scope:
- Remover policy de UPDATE aberta em subscriptions.
- Criar RPC security definer para update de uso e reset.
- Manter update de plan/payment_status/stripe_* apenas via service role.
Checklist:
- update direto via client retorna 403.
- RPCs funcionam para uso e reset.
Files:
- supabase/migrations/*
Ready:
- policy aplicada e validada em staging.

SG-003 - Billing: bloquear uso em payment_failed
Priority: P0
Owner: Tech Lead
Effort: S
Depends on: SG-002
Scope:
- validate-processing bloqueia uso quando payment_status != active.
- webhook atualiza payment_status em eventos de falha/pagamento.
Checklist:
- invoice.payment_failed -> payment_failed.
- validate-processing retorna erro de inadimplencia.
Files:
- supabase/functions/validate-processing/index.ts
- supabase/functions/stripe-webhook/index.ts
Ready:
- fluxo de teste com status payment_failed bloqueia processamento.

SG-004 - Stripe: remover IDs hard-coded
Priority: P0
Owner: Tech Lead
Effort: M
Depends on: none
Scope:
- Centralizar mapeamento plan <-> product/price via ENV ou DB.
- Remover IDs fixos em create-checkout/check-subscription/stripe-webhook.
Checklist:
- IDs trocaveis por env sem code change.
- fallback com erro claro se env ausente.
Files:
- supabase/functions/create-checkout/index.ts
- supabase/functions/check-subscription/index.ts
- supabase/functions/stripe-webhook/index.ts
- src/config/plans.ts
Ready:
- troca de IDs em staging funciona.

SG-005 - Legal: alinhar privacidade/termos ao fluxo real
Priority: P0
Owner: Product
Effort: M
Depends on: none
Scope:
- Atualizar Privacy/Terms com processamento via Edge e coleta de IP.
- Inserir contato do controlador/DPO e politica de retencao.
Checklist:
- textos finais sem "rascunho".
- aprovacao juridica registrada.
Files:
- src/pages/Privacy.tsx
- src/pages/Terms.tsx
- docs/ARCHITECTURE.md
- README.md
Ready:
- revisao juridica concluida.

SG-006 - Staging/Prod: isolamento e variaveis
Priority: P1
Owner: DevOps/SRE
Effort: M
Depends on: none
Scope:
- Criar projetos separados Supabase/Vercel.
- Ajustar redirects/allowed origins por ambiente.
- Atualizar .env.staging.example completo.
Checklist:
- URLs e chaves distintas.
- staging nao acessa dados de prod.
Files:
- .env.staging.example
- docs/STAGING.md
Ready:
- smoke tests ok em staging.

SG-007 - Observabilidade: Sentry + Uptime
Priority: P1
Owner: DevOps/SRE
Effort: S
Depends on: SG-006
Scope:
- Ativar Sentry (frontend).
- Configurar alertas e uptime monitor.
- Definir retencao para error_logs.
Checklist:
- erro de teste aparece no Sentry.
- health-check monitorado com ADMIN_SECRET.
Files:
- src/lib/sentry.ts
- docs/SENTRY_ALERTS.md
- docs/UPTIME_MONITORING.md
- supabase/migrations/* (retencao)
Ready:
- alertas ativos e verificados.

SG-008 - Plano anual persistido no backend
Priority: P1
Owner: Tech Lead
Effort: M
Depends on: SG-004
Scope:
- Adicionar billing_period (month/year) ou plan_variant.
- Atualizar webhook para preencher billing_period via price_id.
- Ajustar UI para exibir anual corretamente.
Checklist:
- compra anual reflete como anual no Account/Plans.
Files:
- supabase/migrations/*
- src/lib/types/subscription.ts
- src/config/plans.ts
Ready:
- teste de compra anual em staging OK.

SG-009 - Onboarding minimo e suporte
Priority: P1
Owner: Product
Effort: S
Depends on: none
Scope:
- Checklist de "primeiro sucesso" no Dashboard.
- Link de suporte e termos/privacidade no header/footer.
Checklist:
- usuario novo conclui fluxo em 3-5 min.
- contato de suporte visivel.
Files:
- src/pages/Dashboard.tsx
- src/pages/Faq.tsx
- src/components/NewHeader.tsx
Ready:
- teste manual com usuario novo OK.

SG-010 - E2E sem skips
Priority: P1
Owner: QA
Effort: S
Depends on: SG-006
Scope:
- Definir E2E_EMAIL/E2E_PASSWORD/PLAYWRIGHT_BASE_URL.
- Rodar suite completa sem skip.
Checklist:
- 7/7 testes passam sem skip.
Files:
- e2e/*.spec.ts
- playwright.config.ts
Ready:
- CI verde com e2e completo.

SG-011 - Backup restore testado
Priority: P1
Owner: DevOps/SRE
Effort: S
Depends on: SG-006
Scope:
- Executar restore em staging a partir de backup.
- Registrar em BACKUP_TEST_LOG.
Checklist:
- restore documentado com data/resultado.
Files:
- backup.sh
- docs/BACKUP_TEST_LOG.md
Ready:
- log atualizado com sucesso.
