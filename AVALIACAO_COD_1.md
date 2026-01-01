Avaliação de Código do Projeto sheet-guardian

Este arquivo contém a revisão crítica do repositório sheet-guardian, incluindo perguntas preliminares, visão de arquitetura, pontos de melhoria, análise de segurança alinhada ao OWASP, recomendações de testes, checklist de produção e um plano de ação em 7 dias.

Perguntas preliminares (informações ausentes)

Apesar de vários artefatos fornecidos, alguns detalhes essenciais não estavam presentes no repositório:

Infra de hospedagem – O front‑end e as funções Edge serão implantados onde (Vercel, Netlify, Supabase Hosting, AWS etc.)?

Integração de CI/CD – Não há pipelines em .github/workflows. Pretendem usar GitHub Actions, Supabase CI, ou outra solução para build/deploy?

Chaves/segredos – As variáveis de ambiente em .env.example e supabase/config.toml são placeholders. Qual será a estratégia de gerenciamento de segredos (Vault, GitHub Secrets, Supabase secrets)?

Versão do banco – A arquitetura indica o uso do PostgreSQL do Supabase, mas não há esquema completo (apenas tipos). Existe necessidade de migrar dados existentes?

A) Visão de arquitetura e “code smells” estruturais
Visão de alto nível

Frontend: SPA em React 18 + TypeScript com Vite, Tailwind e Radix. Internacionalização via i18next. O app se estrutura em páginas (dashboard, planos, conta, landing) com componentes reutilizáveis e hooks (useAuth, useSubscription). O processamento de arquivos Excel é feito no browser e os resultados são baixados pelo usuário. Parte da lógica do Dashboard implementa fila de processamento e atualização de progresso.

Back‑end: Supabase (PostgreSQL + autenticação) com Edge Functions escritas em TypeScript/Deno para validação de tokens, criação de checkout/portal do Stripe, validação e limpeza de tokens, sincronização de assinaturas, processamento de arquivos e webhooks de Stripe. As funções recebem tokens via cabeçalhos e interagem com o banco usando a chave de serviço (SUPABASE_SERVICE_ROLE_KEY) e com a Stripe usando chaves secretas; o rate limiting e o registro de erros são feitos via RPC/tables.

Integrações: Stripe para billing, Sentry para rastreamento de erros (ativado apenas em produção com DSN definido) e Resend para e‑mails no webhook. Feature flags para 2FA e batch upload.

Dados: tabelas principais subscriptions, profiles, processing_tokens e error_logs (definidas em src/services/supabase/types.ts). O repositório inclui doc de arquitetura que explica o fluxo de autenticação, geração de token de processamento e uso do arquivo.

Smells estruturais

Acoplamento rígido dos planos – A página Plans.tsx contém texto, preço e desconto dos planos hard‑coded. Caso novas ofertas sejam criadas no Stripe, será necessário alterar o código e as traduções manualmente. O mesmo se aplica aos limites em PLAN_LIMITS no hook de assinatura.

Fallback de planos – O módulo lib/stripe.ts define IDs de produtos de forma padrão quando variáveis não estão configuradas. Isso pode mascarar configuração incorreta e enviar usuários para produtos errados.

Mock de Supabase no client – Quando VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY não estão definidos, o código cria um cliente “mock” que sempre retorna erros e mostra alerta no header. Essa lógica pode mascarar falhas de configuração em produção.

Repetição de lógica de sincronização – Diversas páginas chamam refetch, syncSubscription e exibem toasts semelhantes. Poderia ser centralizado em um serviço ou hook reutilizável para reduzir duplicação.

Falta de automatização de CI/CD – Não há configuração de pipelines de build/teste/deploy em .github/workflows. Scripts no package.json definem test, test:e2e, lint e build, mas dependem de execução manual.

Ausência de documentação de API – As Edge Functions manipulam diversos erros e códigos, mas a interface não está documentada (payloads de entrada e saída). Isso dificulta integração de novos clientes.

B) Melhorias recomendadas

Centralizar configurações e limites de planos: manter planos, preços, limites e textos em um arquivo de configuração (JSON/YAML) ou tabela no banco. Dessa forma, a página de planos e o serviço de validação usam dados consistentes e podem ser atualizados sem deploy.

Criar wrappers para funções Supabase/Stripe: extrair chamadas repetitivas (ex.: supabase.functions.invoke(...), syncSubscription, refetch) para um SDK interno, facilitando testes e tratamento de erros.

Remover fallbacks perigosos: exigir explicitamente variáveis de ambiente para IDs de produtos do Stripe e exibir erro de configuração se ausentes, em vez de usar valores padrão.

Adicionar Camada de Serviço para Plano e Assinatura: consolidar lógicas dispersas (upgrade, downgrade, criação de assinatura gratuita, verificação de quotas) numa classe/serviço SubscriptionService. Isso reduz duplicação e facilita manutenção.

Documentar API das funções Edge: criar documentação OpenAPI ou README que descreva endpoints, parâmetros, respostas e códigos de erro. Isso ajuda integradores e contribui para testes automatizados.

Adotar rotas protegidas com Suspense e Error Boundary: a SPA já usa React.lazy e ErrorBoundary, mas poderia criar um componente ProtectedRoute com verificação de autorização (por exemplo, redirecionar usuários não logados para /auth), além de fallback de carregamento.

Melhorar observabilidade: integrar logs estruturados das functions ao Supabase/Elastic e Sentry (ou outra solução). Utilizar tags e correlação de request ID para rastrear erros de ponta a ponta.

Separar camadas de apresentação e lógica: mover lógica pesada de UI (por exemplo, verifySubscriptionWithRetry) para hooks ou serviços, deixando os componentes mais declarativos.

C) Segurança (OWASP) – riscos e mitigação

A tabela abaixo resume os principais riscos de segurança identificados no repositório, alinhados ao OWASP Top 10, e propõe formas de mitigá-los.

Categoria OWASP	Risco identificado	Mitigação sugerida	Severidade
A01 – Broken Access Control	Uso de chave de serviço (SUPABASE_SERVICE_ROLE_KEY) nas functions para realizar operações privilegiadas. Se vazada, permite acesso total ao banco.	Armazenar a chave de serviço somente no ambiente das Edge Functions (não enviar ao front‑end); usar Supabase RLS nas tabelas e roles restritas nas functions.	Crítico
A02 – Cryptographic Failures	As funções manipulam arquivos Excel que podem conter macros maliciosas. A verificação atual remove padrões específicos, mas não garante neutralização completa.	Utilizar biblioteca de detecção de macros (e.g., oletools em Python via microserviço) ou fazer sandbox dos arquivos. Assinar macros após limpeza.	Alto
A03 – Injection	Strings de consulta SQL no Supabase são construídas com .eq() e .update(), o que evita injection; porém falta validação de entradas de usuário nas functions, especialmente dados enviados ao Stripe.	Validar e normalizar e‑mails, IDs e parâmetros; usar prepared statements; normalizar entradas antes de chamar APIs externas.	Médio
A04 – Insecure Design	Fallback automático de IDs de planos do Stripe: se variáveis não forem definidas, usa IDs padrão, o que pode levar a cobrança incorreta.	Lançar erro quando variável ausente; implementar verificação de assinaturas no backend.	Alto
A05 – Security Misconfiguration	CORS permissivo nos endpoints. O config.toml do Supabase permite origens locais, mas variáveis mal configuradas podem permitir origens qualquer.	Definir lista explícita de origens de produção; utilizar cabeçalhos de segurança como CSP, X‑Frame‑Options e Referrer‑Policy.	Alto
A07 – Identification & Authentication Failures	O hook useAuth implementa rate limiting via RPC, mas a proteção anti‑brute force depende de Supabase; MFA não é obrigatório.	Habilitar MFA obrigatório para planos pagos; usar requireEmailConfirmation e expirar tokens longos; auditar RPC de rate limit.	Médio
A08 – Software and Data Integrity Failures	Dependências desatualizadas ou vulneráveis no package.json; não há verificação de integridade das dependências.	Configurar pipeline de CI para executar npm audit/pnpm audit, atualizando dependências.	Médio
A09 – Security Logging & Monitoring	As funções registram erros em error_logs, mas não há notificação ou alarme para eventos críticos.	Integrar error_logs a serviço de monitoramento (Sentry, Datadog); definir alertas para falhas de pagamento e uso de tokens.	Médio

Outros riscos incluem exposição de dados pessoais (exibição do ID do usuário em Account.tsx), falta de verificação robusta de sessão e necessidade de executar ferramentas de secret scanning no repositório.

D) Testes

Apesar de haver configuração para Vitest (unit tests) e Playwright (e2e), vários testes importantes estão ausentes. Sugestões:

Testes unitários para funções de utilidade (feature-flags.ts, error-tracker.ts, logger.ts), hooks (useAuth, useSubscription, useSubscriptionManagement) e funções Edge (mockando chamada ao Supabase e Stripe).

Testes de integração para fluxos principais: upload e processamento de arquivos, upgrade/downgrade de plano, autenticação e MFA.

Testes e2e com Playwright para validar navegação entre páginas (Landing, Auth, Dashboard, Plans, Account) e capturar regressões visuais.

Testes de segurança: fuzzing no processamento de arquivos, verificação de CORS e autenticação.

E) Checklist de produção / CI‑CD

Pipeline automatizado: criar workflow do GitHub Actions que executa pnpm install, pnpm test, pnpm run lint, pnpm run build e pnpm run test:e2e; usar cache; executar pnpm audit.

Gestão de segredos: armazenar chaves (SUPABASE_URL, SUPABASE_ANON_KEY, SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SENTRY_DSN, RESEND_API_KEY) em GitHub Secrets ou ferramenta centralizada.

Ambiente e variáveis: definir .env.production fora do versionamento; remover fallbacks; configurar ALLOWED_ORIGINS com domínios de produção.

Migrações: usar Supabase Migrations para versionar esquema e índices.

Deploy: hospedar front‑end em CDN (Vercel, Netlify) e deploy das functions via supabase functions deploy; configurar rollback automático.

Observabilidade: habilitar logs estruturados, Sentry e alertas; adicionar cabeçalhos de segurança (CSP, HSTS, X‑Content‑Type‑Options) via CDN.

F) Plano de ação em 7 dias
Dia	Atividades
Dia 1	Reunião de alinhamento: esclarecer perguntas pendentes (infra, CI/CD, gestão de segredos). Revisar arquitetura atual com a equipe. Configurar ferramentas de secret scanning.
Dia 2	Refatorar configurações de planos: mover planos e limites para arquivo/tabela configurável e remover fallbacks em lib/stripe.ts. Criar serviço SubscriptionService.
Dia 3	Implementar pipeline CI: adicionar workflow do GitHub Actions que roda lint, testes, build e auditoria de dependências; configurar secrets; adicionar badge de status no README.
Dia 4	Fortalecer segurança: ajustar CORS e cabeçalhos nas functions; remover exposição do ID de usuário em Account.tsx; validar e normalizar entradas em todas as functions; exigir variáveis obrigatórias.
Dia 5	Testes: escrever testes unitários para hooks e utilidades. Criar testes de integração para process-file e validate-processing. Configurar Playwright para navegar pelos fluxos principais.
Dia 6	Observabilidade: configurar Sentry/Logflare; adicionar logs com correlação de request ID; criar alertas para falhas críticas (assinaturas, upload).
Dia 7	Deployment: provisionar infra de produção (CDN + Supabase); rodar migrações; implementar deploy automatizado das functions. Executar testes end‑to‑end no ambiente staging e ajustar; preparar documentação de API e instruções de rollback.
Conclusão

O projeto sheet-guardian apresenta uma base sólida, mas precisa de ajustes para garantir escalabilidade e segurança. Refatorar a lógica de planos, fortalecer controle de acesso, documentar APIs e automatizar testes/deploys são ações prioritárias. Seguindo o plano proposto, em uma semana será possível profissionalizar o aplicativo e prepará-lo para produção.