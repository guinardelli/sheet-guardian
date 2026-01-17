# Sheet Guardian — SaaS Product Evaluation & Execution Roadmap

> **Evaluation Date**: January 16, 2026  
> **Status**: Execution Phase  
> **Source of Truth**: `saas_evaluation.md`

---

## 🚀 Execution Overview

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1** | P0 Security & Billing Blockers | **In Progress** |
| **Phase 2** | P1 Operations & Observability | Pending |
| **Phase 3** | P1/P2 Growth & Experience | Pending |

---

## 🛠️ Implementation Track (P0 - Critical)

| ID | Task | Status | Notes / Decisions |
|----|------|--------|-------------------|
| SG-001 | Token mandatory in `process-file` | **Done** | Token implementado e verificação endurecida (atômica). |
| SG-002 | RLS lock on `subscriptions` | **Done** | Migrations 20260125/26 confirmadas. Update via client bloqueado. |
| SG-003 | Block usage on `payment_failed` | **Done** | Validado no validate-processing e process-file. |
| SG-004 | Remove hard-coded Stripe IDs | **Done** | Centralizado via ENV no backend e frontend. |
| SG-005 | Privacy/Terms LGPD compliance | **Done** | Textos corrigidos para refletir Edge Functions e links adicionados. |
| SG-007 | Observabilidade: Sentry + Uptime | **Done** | Sentry integrado e configurado no logger global. |
| SG-008 | Plano anual persistido no backend | **Done** | Coluna `billing_period` adicionada e webhook atualizado. |
| SG-011 | Footer com links institucionais | **Done** | Links de FAQ, Privacidade e Termos adicionados ao Index. |

---

## 📊 Detailed Task Breakdown

### SG-001: Token mandatory in `process-file`
- [ ] Exigir `processingToken` no request (body ou header) de `process-file`
- [ ] Validar token em `processing_tokens` (existe, não expirado, não usado)
- [ ] Marcar `used_at` de forma atômica
- [ ] Retornar 401/403 se o token for inválido

### SG-002: RLS lock on `subscriptions`
- [ ] Remover Update Policy pública da tabela `subscriptions`
- [ ] Criar RPC (Security Definer) para incremento de uso
- [ ] Criar RPC para reset de plano (upgrade/downgrade) via service role logic

### SG-003: Block usage on `payment_failed`
- [ ] Alterar `validate-processing` para ler `payment_status`
- [ ] Bloquear se `payment_status` for `payment_failed`, `past_due` ou `unpaid`
- [ ] Garantir que webhook do Stripe atualize esse status

### SG-004: Remove hard-coded Stripe IDs
- [ ] Mapear IDs no `supabase/functions/create-checkout/index.ts` via env
- [ ] Remover IDs residuais no `src/config/plans.ts` (já parcialmente feito, mas validar)

### SG-005: Privacy/Terms LGPD compliance
- [ ] Atualizar `src/pages/Privacy.tsx`
- [ ] Atualizar `src/pages/Terms.tsx`
- [ ] Remover referências a "processamento local" se o padrão for Edge

---

## 📝 Recent Decisions & Blockers

- **Decision (2026-01-16)**: Prioritizing technical security (SG-001/SG-002) to prevent unauthorized API usage before opening sales.
- **Blocker**: Waiting for confirmation on final production domain for Stripe redirect URLs.
- **Blocker**: Need to confirm if `VITE_STRIPE_*` env vars are already set in the target environment.

---

## 📈 Success Metrics (Real-time)

- **P0 Completion**: 0%
- **Security Audit**: Pending
- **E2E Success Rate**: [Check CI status]
