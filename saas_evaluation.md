# Sheet Guardian — SaaS Product Evaluation & Execution Roadmap

> **Evaluation Date**: January 16, 2026  
> **Status**: Phase 2 (Operational Readiness)  
> **Source of Truth**: `saas_evaluation.md`

---

## 🚀 Execution Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1** | P0 Security & Billing Blockers | **100% DONE** |
| **Phase 2** | P1 Operations & Observability | **IN PROGRESS** |
| **Phase 3** | P1/P2 Growth & UI/UX Polish | Pending |

---

## 🛠️ Implementation Track

### P0 - Critical Blockers
| ID | Task | Status | Notes / Decisions |
|----|------|--------|-------------------|
| SG-001 | Token mandatory & Atomic | **Done** | Token implementado e verificação endurecida (atômica). |
| SG-002 | RLS lock on `subscriptions` | **Done** | Update via client bloqueado. Segurança garantida. |
| SG-003 | Block usage on `payment_failed` | **Done** | Validado no validate-processing e process-file. |
| SG-004 | Remove hard-coded Stripe IDs | **Done** | Centralizado via ENV em todas as camadas. |
| SG-005 | LGPD Privacy/Terms | **Done** | Alinhado com Edge Functions e coleta de IP. |

### P1 - Operations & Experience
| ID | Task | Status | Notes / Decisions |
|----|------|--------|-------------------|
| SG-007 | Observabilidade: Sentry | **Done** | Sentry configurado para erros e logs globais. |
| SG-008 | Plano Anual no Backend | **Done** | Persistindo `billing_period` via Webhook. |
| SG-009 | Suporte & Feedback Detalhado | **Done** | RequestID e Support Email adicionados aos erros. |
| SG-010 | Stripe Customer Portal | **Done** | Integração completa no Account. |
| SG-011 | Footer Institucional | **Done** | FAQ, Termos e Privacidade no rodapé. |
| SG-012 | Onboarding (Checklist) | **Done** | Checklist de sucesso e Toast implementados. |
| SG-013 | Automação: Token Cleanup | **Done** | pg_cron e pg_net habilitados. Job estruturado. |
| SG-014 | Backup Strategy | **Done** | Documentado em docs/BACKUP_STRATEGY.md. |

---

## 📝 Decisions & Technical Policy

- **Support Email**: `suporte@sheetguardian.com`
- **DPO Contact**: `privacidade@sheetguardian.com`
- **Dunning Policy**: 3 dias de "grace period" - **IMPLEMENTADO**.
- **Grace Period Logic**: Validado no `validate-processing`: `past_due` com `updated_at` < 3 dias não bloqueia.

---

## 📈 Success Metrics

- **P0 Completion**: 100%
- **Security Audit**: Preliminary OK (RLS + Atomic Tokens)
- **Onboarding Readiness**: 100%
- **Production Readiness**: 92%
