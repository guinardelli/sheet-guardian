🛡️ Plano de Execução QA & SRE: Sheet Guardian
Autor: QA Lead / SRE
Data: 31/12/2025
Versão: 1.0
Status: APROVADO (P0/P1 implementados)
Atualizado: 20/01/2026
0. Atualizações Implementadas (P0/P1)
- Padronização de hospedagem: Vercel confirmado e netlify.toml removido.
- Edge Function validate-processing + migração processing_tokens para tokens de processamento atômicos.
- Validação profunda de arquivos (MIME + magic bytes) no upload e no processamento.
- ErrorBoundary e ProtectedRoute adicionados e integrados ao App.
- CI com npm audit e CodeQL SAST.
- Documentação de backup/restore (BACKUP_RESTORE.md).
1. Contexto e Arquitetura Inferida
Baseado na análise estática do repositório, esta é a topologia do sistema:
Frontend: SPA (Single Page Application) em React + TypeScript (Vite), utilizando TailwindCSS e Shadcn/UI.
Backend / Infra: Serverless e BaaS (Backend-as-a-Service).
Supabase: Banco de dados PostgreSQL, Autenticação, Storage e Edge Functions.
Hospedagem Frontend: Vercel (netlify.toml removido; vercel.json permanece).
Core Logic:
A lógica de modificação de VBA parece residir no cliente (src/lib/excel-vba-modifier.ts), o que implica processamento local no navegador.
As validações de assinatura ocorrem via Edge Functions (supabase/functions/check-subscription).
Integrações Externas:
Stripe: Gestão de assinaturas e pagamentos (Webhooks em supabase/functions/stripe-webhook).
Ambientes:
Local: Vite server + Supabase local.
CI: GitHub Actions (.github/workflows/ci.yml).
Produção: URL pública (Vercel ou Netlify).
2. Entregáveis Obrigatórios
A. Checklist de Produção (Go/No-Go)
Categoria
Item de Verificação
Referência no Código
Critério Passa/Falha
Build & Deploy
Definir infraestrutura de Frontend (Vercel vs Netlify). Remover arquivo de config não utilizado. (Implementado: Vercel padronizado; netlify.toml removido.)
vercel.json
🟢 Passa se netlify.toml estiver ausente.
Build & Deploy
Verificar ci.yml: O build deve passar sem warnings críticos de lint/type.
.github/workflows/ci.yml
🟢 Passa se build for verde.
Config & Secrets
Variáveis de ambiente (VITE_SUPABASE_URL, STRIPE_SECRET_KEY) configuradas no painel da Cloud.
.env.example
🔴 Falha se hardcoded ou vazias.
Banco de Dados
Todas as migrações SQL aplicadas, especialmente as recentes de Rate Limit e Logs.
supabase/migrations/
🟢 Passa se DB estiver sincronizado.
Banco de Dados
RLS (Row Level Security) ativo em todas as tabelas públicas (especialmente profiles).
supabase/migrations/*
🔴 Falha se tabela permitir acesso público irrestrito.
Observabilidade
Logging de erros configurado no Supabase Functions.
supabase/functions/_shared/logger.ts
🟢 Passa se logs aparecerem no dashboard.
Segurança
Validar webhook do Stripe com assinatura (STRIPE_WEBHOOK_SECRET).
supabase/functions/stripe-webhook/index.ts
🔴 Falha se endpoint for público sem validação.
Confiabilidade
Fallback de UI para falha no carregamento de componentes (Error Boundaries).
src/components/ErrorBoundary.tsx, src/App.tsx
🟢 Passa (implementado).
Dados
Política de retenção de arquivos no Storage (se houver upload).
supabase/storage (inferido)
🟢 Passa se houver cron de limpeza.
Legal
Termos de Uso e Política de Privacidade acessíveis e atualizados.
src/pages/Index.tsx (rodapé)
🔴 Falha se links 404.

B. Matriz de Riscos (Top 15)
Risco
Impacto
Probabilidade
Detecção
Mitigação
Dono
Bypass de Assinatura
Alto (Financeiro)
Média
Logs de transação vs Logs de uso
Validar status da assinatura no Backend (Edge Function) antes de qualquer ação crítica, não confiar apenas no estado do Frontend.
Backend Dev
Vazamento de Chaves API
Crítico
Baixa
GitHub Scanning
Garantir que .env não vá para o git. Usar segredos do GitHub Actions.
SRE
Falha no Webhook Stripe
Alto (UX/Financeiro)
Média
Monitoramento Stripe
Implementar retries no Stripe e endpoint de "sincronizar status" manual no client.
Backend Dev
Arquivo Excel Corrompido
Médio (UX)
Alta
Erro no parse JS
Try/Catch robusto em excel-vba-modifier.ts com mensagem amigável ao usuário.
Frontend Dev
Rate Limit do Supabase
Médio (Disponibilidade)
Média
Status 429
Implementar exponential backoff no client (src/lib/utils.ts ou hooks).
SRE
Upload de Malware
Crítico
Baixa
Antivírus do usuário
Validar MIME types e "magic bytes" do arquivo antes de processar. (Implementado: FileDropzone + excel-vba-modifier.)
QA/Sec
Conflito de Migrations
Alto (Downtime)
Baixa
Falha no Deploy
Teste de migração em ambiente de Staging antes de Prod.
Backend Dev
Cold Start das Functions
Baixo (Latência)
Alta
Métricas de tempo
Manter functions leves (check-subscription parece pequena, ok).
SRE
Logic Drift (Client vs Server)
Médio (Bug)
Média
Testes E2E
Centralizar tipos em src/integrations/supabase/types.ts.
Fullstack
Perda de Sessão Auth
Médio (UX)
Média
Reclamação usuário
Testar renovação de token JWT e Refresh Token.
QA
Exaustão de Cotas (Free Tier)
Alto (Bloqueio)
Média
Alertas de Custo
Configurar alertas de faturamento no Supabase e Vercel/Netlify.
Product Owner
Browser Compatibility
Médio (UX)
Média
Analytics
Testar em Safari (iOS) e Firefox, além do Chrome.
QA
LGPD/GDPR (Dados em Log)
Alto (Legal)
Baixa
Auditoria
Garantir que logger.ts anonimiza PII (e-mails, IPs) antes de gravar.
SRE
DDOS em rotas públicas
Médio (Custo)
Baixa
WAF Logs
Cloudflare ou Rate Limiting nativo do Supabase na borda.
SRE
Dependências Vulneráveis
Médio (Segurança)
Média
Dependabot
Rodar npm audit no CI. (Implementado no ci.yml.)
Dev

C. Plano de Testes por Nível
1. Testes Unitários (vitest)
Foco: Lógica de negócio isolada.
Alvos:
src/lib/excel-vba-modifier.ts: Testar parsing de arquivos válidos, corrompidos e protegidos por senha.
src/hooks/useSubscription.tsx: Mockar respostas do Supabase e garantir estados corretos (free, pro, expired).
src/lib/utils.ts: Funções auxiliares de formatação.
2. Testes de Integração
Foco: Comunicação Frontend <-> Backend.
Cenários:
Fluxo de Login e Signup (Supabase Auth).
Chamada à Edge Function check-subscription.
Upload de arquivo para Bucket (se aplicável).
3. Testes de Contrato (APIs)
Foco: Stripe e Edge Functions.
Cenários:
Validar payload do Webhook do Stripe (invoice.payment_succeeded, customer.subscription.deleted).
Garantir que a estrutura do JSON de resposta das Functions não mudou.
4. Testes E2E (Sugestão: Playwright ou Cypress)
Foco: Jornada do usuário completa.
Fluxos:
Visitante -> Login -> Dashboard (Free).
Dashboard -> Tentativa de upload (Sucesso/Falha).
Upgrade Plan -> Checkout Stripe (Mockado/Test Mode) -> Sucesso -> Dashboard (Pro).
Logout.
5. Testes de Segurança (SAST/DAST)
SAST: CodeQL configurado no workflow .github/workflows/codeql.yml.
Manual: Tentar acessar /dashboard sem estar logado (bypass de rota). Tentar chamar a Function de create-checkout sem token de auth.
D. Testes Específicos do Contexto do App
Baseado na funcionalidade "Sheet Guardian" (Desbloqueio de planilhas):
Cenário 1: Processamento de Arquivo Válido (Caminho Feliz)
Given: Usuário autenticado com plano "Pro".
And: Possui um arquivo teste_qa_bloqueado.xlsm (do repo).
When: Faz o upload do arquivo no componente FileDropzone.
Then: O sistema deve aceitar o arquivo.
And: O processamento deve iniciar (ProcessingLog deve aparecer).
And: O download do arquivo desbloqueado deve ser oferecido.
Asset: O arquivo baixado deve ser editável no Excel.
Cenário 2: Limite de Uso do Plano Free
Given: Usuário autenticado com plano "Free".
And: O banco de dados indica que o usuário já processou 1 arquivo hoje (verificar tabela usage_logs ou similar na migration 20251210_add_rate_limiting.sql).
When: Tenta fazer upload de um segundo arquivo.
Then: Um modal/toast de "Upgrade necessário" deve aparecer.
And: Nenhuma chamada para a API de processamento deve ser feita.
Cenário 3: Arquivo Malicioso/Inválido
Given: Usuário autenticado.
When: Tenta fazer upload de um .exe renomeado para .xlsx.
Then: O sistema deve rejeitar no client-side (validação de mimetype/extensão).
And: Mensagem de erro "Formato inválido" deve ser exibida.
Cenário 4: Webhook de Cancelamento
Given: Assinatura ativa no DB.
When: Webhook customer.subscription.deleted é enviado para stripe-webhook.
Then: O campo subscription_status na tabela profiles deve mudar para canceled ou free.
And: O acesso a features Pro deve ser revogado imediatamente no Frontend (após refresh).
E. Automação no CI/CD (GitHub Actions)
Sugestão de pipeline robusto baseado no arquivo ci.yml existente:
Trigger: Push na main, Pull Requests.
Job 1: Quality Gate (Bloqueante)
Checkout código.
Install dependencies (npm ci).
Linting (npm run lint - verificar eslint.config.js).
Type Checking (tsc --noEmit).
Unit Tests (npm run test ou vitest run). Cobertura mínima sugerida: 70%.
Job 2: Security Audit
npm audit --audit-level=high. (Implementado no ci.yml.)
Job 3: Build Preview
npm run build.
Verificar tamanho do bundle (Performance budget).
3. Perguntas Bloqueantes (P0)
Antes de autorizar o deploy para Produção, preciso das seguintes respostas:
Hospedagem: Vercel (netlify.toml removido) como plataforma oficial de produção.
Lógica de Desbloqueio: Onde ocorre a remoção da senha do VBA? O arquivo src/lib/excel-vba-modifier.ts sugere que é no browser. Se for no browser, temos um risco de Propriedade Intelectual (o código de desbloqueio é exposto ao usuário). Isso é intencional?
Persistência: Os arquivos enviados pelos usuários são salvos no Supabase Storage ou apenas processados em memória (RAM do browser)? Se salvos, temos cron jobs para deletá-los (custo/privacidade)?
Environment: Onde estão as variáveis de produção? O env.example é genérico. Quem tem acesso ao dashboard do Supabase Prod?
4. Estratégia de Rollback & Monitoramento Pós-Deploy
Checklist de Rollback
[ ] O Vercel/Netlify permite "Instant Rollback" para o commit anterior.
[ ] Migrações de banco foram desenhadas para serem não-destrutivas (adicionar colunas é ok, remover/renomear requer cuidado).
[ ] Scripts de reversão de migration (down migrations) existem? (Não vistos na pasta migrations). Recomendação: Criar scripts de revert para alterações críticas.
Smoke Test Pós-Deploy
Acessar URL de Produção.
Logar com usuário de teste "Smoke User".
Verificar se o status da assinatura carrega corretamente.
Realizar upload de teste_qa_bloqueado.xlsm.
Confirmar sucesso no processamento.
