# Sheet Guardian — Proteja seu código VBA em planilhas .xlsm

## O que é
Sheet Guardian é um web app que recebe planilhas Excel .xlsm (com macros), ajusta padrões de proteção do projeto VBA (CMG/DPB/GC) e devolve o arquivo pronto para uso. Ele atende tanto usuários finais que querem distribuir planilhas sem expor o código quanto times que precisam de autenticação, limites de uso e cobrança.

## Link do app (produção)
https://vbablocker.vercel.app

## Índice
- [Para quem é / Casos de uso](#para-quem-é--casos-de-uso)
- [Como funciona (visão geral)](#como-funciona-visão-geral)
- [Funcionalidades](#funcionalidades)
- [Planos e limites](#planos-e-limites)
- [Como usar (passo a passo, sem imagens)](#como-usar-passo-a-passo-sem-imagens)
- [Segurança, privacidade e limitações](#segurança-privacidade-e-limitações)
- [Desenvolvimento local](#desenvolvimento-local)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Supabase (setup)](#supabase-setup)
- [Stripe (setup)](#stripe-setup)
- [Testes](#testes)
- [Deploy (Vercel)](#deploy-vercel)
- [Estrutura do projeto](#estrutura-do-projeto)
- [FAQ / Troubleshooting](#faq--troubleshooting)
- [Contribuindo](#contribuindo)
- [Licença](#licença)
- [Créditos/Agradecimentos](#créditosagradecimentos)

## Para quem é / Casos de uso
- Consultores e freelancers que entregam planilhas com lógica proprietária e não querem expor macros.
- Vendedores de planilhas e dashboards que distribuem arquivos para clientes.
- Times internos que precisam compartilhar planilhas sem abrir o editor VBA.

## Como funciona (visão geral)
- .xlsm é o formato do Excel habilitado para macros.
- VBA é a linguagem usada nessas macros.
- CMG/DPB/GC são identificadores internos do projeto VBA relacionados à proteção do editor.

Fluxo, em linguagem simples:
1. Você entra com sua conta (Supabase Auth).
2. Escolhe o arquivo .xlsm no Dashboard.
3. O app valida extensão, tipo e tamanho, e checa os limites do seu plano.
4. O arquivo é enviado para a Edge Function `process-file`, que abre o arquivo (um ZIP) e ajusta o bloco `xl/vbaProject.bin` para neutralizar os padrões CMG/DPB/GC.
5. Você recebe o arquivo modificado para baixar. Se padrões foram encontrados, o uso é contabilizado.

Observação: há um módulo de processamento local em `src/lib/excel-vba-modifier.ts`, mas o fluxo padrão do app usa o processamento via Edge Function.

## Funcionalidades
- Upload e validação de arquivos .xlsm (extensão, MIME e assinatura ZIP).
- Processamento do VBA em Edge Function com geração de arquivo final e nome com timestamp.
- Log de processamento, métricas de alteração e download do arquivo final (ou do original).
- Contas e login por e-mail/senha (Supabase Auth), com rate limit por IP nas tentativas.
- Planos e limites por uso (semanal/mensal) e por tamanho de arquivo.
- Checkout e portal de assinatura via Stripe.
- Registro de erros no banco (`error_logs`) e integração opcional com Sentry.
- 2FA via Supabase (habilitável por feature flag).
- Endpoints administrativos de health-check e limpeza de tokens (protegidos por `ADMIN_SECRET`).

## Planos e limites
Limites configurados no código (veja `src/config/plans.ts` e `supabase/functions/validate-processing/index.ts`).

| Plano | Processamentos | Tamanho máx. por arquivo | Observações |
| --- | --- | --- | --- |
| Gratuito | 2 por mês | 1 MB | Plano de entrada |
| Profissional | 5 por semana | 3 MB | Para uso recorrente |
| Premium | Ilimitado | Sem limite no plano | Sujeito ao teto de segurança |
| Anual | Ilimitado | Sem limite no plano | Mesmo limite do Premium (cobrança anual) |

Teto de segurança: o app bloqueia arquivos acima de 50 MB no frontend e no backend.

## Como usar (passo a passo, sem imagens)
1. Acesse o site: https://vbablocker.vercel.app
2. Crie uma conta ou faça login.
3. Vá para o Dashboard.
4. Selecione um arquivo .xlsm.
5. Clique em “Iniciar Processamento”.
6. Aguarde o término e baixe o arquivo final.
7. Abra no Excel e valide o comportamento das macros.

Requisitos e dicas:
- Use um navegador moderno (Chrome, Edge, Firefox ou Safari).
- O arquivo precisa ser .xlsm (planilhas .xls não são suportadas).
- Respeite os limites do seu plano e o tamanho máximo.
- Faça backup do arquivo original antes de processar.

## Segurança, privacidade e limitações
Processamento e tráfego
- O fluxo atual envia o arquivo para a Edge Function `process-file` e processa em memória; não há gravação em storage no código.

Dados armazenados
- Conta: e-mail e identificador do usuário (Supabase Auth).
- Assinaturas e uso: plano, contadores de uso, datas de reset e IDs do Stripe.
- Segurança: tentativas de autenticação com IP, e-mail e user-agent (`auth_attempts`).
- Operação: tokens de processamento (`processing_tokens`) e eventos de webhook (`stripe_webhook_events`).
- Observabilidade: logs de erro no `error_logs` (mensagem, stack, URL e contexto).

Retenção
- `auth_attempts` tem limpeza automática para registros com mais de 30 dias (função SQL).
- `processing_tokens` têm TTL curto (5 minutos) e limpeza por `cleanup-tokens`.
- Não há política de retenção automática configurada para `error_logs` no repositório.

Limitações
- Suporta apenas .xlsm.
- Modifica apenas padrões CMG/DPB/GC do VBA; não remove senha de arquivo, planilha ou workbook.
- Arquivos corrompidos ou com estruturas incomuns podem falhar.
- Não há garantia de 100% contra macros ofuscadas ou proteções diferentes.

Uso responsável
- Use apenas em arquivos próprios ou com autorização. O objetivo é proteção legítima e distribuição segura.

## Desenvolvimento local
Pré-requisitos
- Node.js 20 (mesma versão do CI).
- npm.
- Conta Supabase (Auth + DB) e Stripe (test/labs).
- Supabase CLI (opcional, para migrations e Edge Functions).

Instalação e execução
```bash
npm install
npm run dev
```

Build/preview
```bash
npm run build
npm run preview
```

## Variáveis de ambiente
Frontend (Vite)
| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| VITE_SUPABASE_PROJECT_ID | Sim | ID do projeto Supabase (URL). |
| VITE_SUPABASE_PUBLISHABLE_KEY | Sim | Chave anon/pública do Supabase. |
| VITE_SUPABASE_URL | Sim | URL do projeto Supabase. |
| VITE_STRIPE_PROFESSIONAL_PRODUCT_ID | Sim | Product ID do plano Profissional (Stripe). |
| VITE_STRIPE_PROFESSIONAL_PRICE_ID | Sim | Price ID do plano Profissional (Stripe). |
| VITE_STRIPE_PREMIUM_PRODUCT_ID | Sim | Product ID do plano Premium (Stripe). |
| VITE_STRIPE_PREMIUM_PRICE_ID | Sim | Price ID do plano Premium (Stripe). |
| VITE_STRIPE_ANNUAL_PRICE_ID | Sim | Price ID do plano Anual (Stripe). |
| VITE_SENTRY_DSN | Não | DSN do Sentry (monitoramento). |
| VITE_LOG_LEVEL | Não | Nível de log (debug/info/warn/error). |
| VITE_FEATURE_2FA | Não | Ativa 2FA no app (true/false). |
| VITE_FEATURE_BATCH | Não | Flag para batch (não implementado no fluxo atual). |
| VITE_PLAUSIBLE_DOMAIN | Não | Domínio para analytics (se usar). |

Edge Functions (Supabase Secrets)
| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| SUPABASE_URL | Sim | URL do Supabase (Edge). |
| SUPABASE_ANON_KEY | Sim | Anon key para validar JWT do usuário. |
| SERVICE_ROLE_KEY | Sim | Service role para operações administrativas. |
| STRIPE_SECRET_KEY | Sim | Chave secreta do Stripe. |
| STRIPE_WEBHOOK_SECRET | Sim | Segredo do webhook do Stripe. |
| STRIPE_ANNUAL_PRICE_ID | Sim | Price ID anual usado no checkout. |
| ADMIN_SECRET | Sim | Token para endpoints de manutenção. |
| RESEND_API_KEY | Não | API key do Resend (e-mails). |
| RESEND_FROM_EMAIL | Não | Remetente padrão do Resend. |

## Supabase (setup)
- Aplique as migrations em `supabase/migrations/`.
- Tabelas principais: `profiles`, `subscriptions`, `processing_tokens`, `error_logs`, `auth_attempts`, `stripe_webhook_events`.
- Edge Functions usadas pelo app:
  - `validate-processing` (emite/consome token e valida limites)
  - `process-file` (processa .xlsm)
  - `check-subscription` (sincroniza com Stripe)
  - `create-checkout` (checkout Stripe)
  - `customer-portal` (portal de cobrança)
  - `stripe-webhook` (eventos Stripe)
  - `cleanup-tokens` e `health-check` (manutenção)
- Configure secrets no Supabase para as funções (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SERVICE_ROLE_KEY`, `STRIPE_*`, `ADMIN_SECRET`).
- Agende a função `cleanup-tokens` conforme `docs/SUPABASE_SCHEDULES.md`.
- Para 2FA, habilite MFA no Supabase e defina `VITE_FEATURE_2FA=true`.

## Stripe (setup)
- Crie produtos e preços para Profissional e Premium.
- Defina o price anual (usado pelo plano “Anual”).
- Atualize IDs nos arquivos:
  - `supabase/functions/create-checkout/index.ts` (allowlist de price IDs)
  - `supabase/functions/check-subscription/index.ts` e `supabase/functions/stripe-webhook/index.ts` (mapa produto -> plano)
- Configure o webhook para `stripe-webhook` conforme `docs/STRIPE_LIVE_SETUP.md`.

## Testes
Unitários (Vitest)
```bash
npm test -- --run
npm run test:ui
```

E2E (Playwright)
```bash
npm run test:e2e
npm run test:e2e:ui
```

Variáveis para E2E:
- `PLAYWRIGHT_BASE_URL` (opcional)
- `E2E_EMAIL` e `E2E_PASSWORD`
- `E2E_UPLOAD_FILE` (ex: `teste_qa_desbloqueado.xlsm`)
- `E2E_CHECKOUT=true` (para abrir checkout)

## Deploy (Vercel)
- Build com `npm run build` (output `dist/`).
- `vercel.json` configura rewrite SPA e headers de segurança (CSP, HSTS, etc.).
- Defina as variáveis de ambiente no projeto Vercel.
- Use `docs/RUNBOOK_DEPLOY.md` e `docs/STAGING.md` para checklist e staging.

## Estrutura do projeto
- `src/` — UI, rotas, hooks, validação e integração com Supabase.
- `supabase/` — migrations e Edge Functions.
- `docs/` — runbooks, staging e operação.
- `e2e/` — testes de ponta a ponta (Playwright).
- `.github/workflows/` — CI, CodeQL, DAST e backup semanal.
- `public/` — assets estáticos.

## FAQ / Troubleshooting
**Meu arquivo não processa, e agora?**
- Verifique se é .xlsm, se não está corrompido e se está dentro do limite do seu plano.
- Faça logout/login e tente novamente.
- Tente um arquivo menor para descartar problemas de tamanho.

**O que muda no meu arquivo?**
- Apenas padrões de proteção no projeto VBA. Fórmulas, dados e layout não são alterados.

**Isso remove senha do Excel?**
- Não. O foco é no projeto VBA, não em senhas de arquivo/planilha.

**Funciona no Mac?**
- Sim, o app é web. Para abrir o resultado, você precisa do Excel para Mac (ou compatível).

**Meu antivírus/Excel acusou macro.**
- O arquivo continua com macros. Abra apenas se você confiar no arquivo e no remetente.

**Meu plano não atualizou após o pagamento.**
- Aguarde alguns minutos, faça logout/login e verifique novamente. O app sincroniza com o Stripe.

**Como cancelar/gerenciar minha assinatura?**
- Use o botão de “Gerenciar Assinatura” na página de Planos ou Conta (abre o portal do Stripe).

**O processamento é local?**
- No fluxo atual, o arquivo é enviado para a Edge Function. Não há armazenamento do arquivo no código.

## Contribuindo
- Use Issues para bugs e sugestões.
- Envie PRs com testes e `npm run lint`/`npm run type-check`.
- Não inclua arquivos `.env` ou chaves no commit.

## Licença
Nenhum arquivo LICENSE foi encontrado no repositório.

## Créditos/Agradecimentos
Vite, React, Supabase, Stripe, JSZip, Playwright, Vitest, Tailwind CSS e Radix UI.
