Avaliação de Código: Sheet Guardian

Este relatório analisa criticamente o repositório sheet-guardian (Vite/React + Supabase + Stripe) a pedido do usuário, que atua como Engenheiro de Estruturas. O aplicativo foi construído com auxílio de IA e oferece uma ferramenta para remover proteções de macros em arquivos .xlsm. A avaliação cobre arquitetura, riscos de segurança alinhados ao OWASP, testes, melhoria de código e um plano de deploy em produção.

A) Visão geral da arquitetura e code smells
Arquitetura de alto nível

O repositório implementa uma aplicação SPA (Single‑Page Application) em React e TypeScript utilizando Vite para bundling, Tailwind para estilos, i18n para internacionalização e Sentry para captura de erros. A estrutura principal é:

Cliente web (src/) – Contém as páginas (Index, Auth, Dashboard, Plans, Account), hooks (useAuth, useSubscription, useSubscriptionManagement), utilitários (excel‑vba‑modifier, logger, IP fetch), e integração com Supabase via @supabase/supabase-js. O roteamento é feito com React Router e a interface com shadcnUI.

Funções serverless (supabase/functions) – Escritas em Deno para execução no edge via Supabase. Funções principais:

validate-processing controla os limites de uso por plano, gera e consome tokens de processamento e calcula limites semanais/mensais
github.com
.

check-subscription sincroniza o status de planos com a API da Stripe e atualiza a tabela subscriptions
github.com
.

create-checkout e customer-portal integram com Stripe para criar sessões de pagamento e portal de cobrança
github.com
github.com
.

stripe-webhook processa eventos da Stripe, resolvendo o usuário através de Metadados, atualizando registros e enviando e‑mails
github.com
.

health-check e cleanup-tokens cuidam de monitoramento e limpeza de tokens expirados
github.com
github.com
.

Supabase – Usado como banco de dados (PostgreSQL), autenticação e edge functions. As tabelas principais são profiles, subscriptions, processing_tokens e error_logs
github.com
. Regras de acesso (RLS) restritas controlam leitura/escrita de dados.

Stripe – Gerencia planos pagos. Produtos e preços são definidos via arquivo de configuração. Webhooks tratam eventos de cobrança e atualização de assinatura.

Infraestrutura – Deploy recomendado em Vercel (client) e Supabase Edge. O arquivo vercel.json especifica headers de segurança (CSP, HSTS, X‑Frame‑Options etc.) e redirecionamento de rotas
github.com
. Há documentação em docs/* com planos de produção, checklists e runbooks de deploy
github.com
.

Code smells e problemas estruturais

Acoplamento forte entre lógica de negócios e hooks React (Médio) – O hook useSubscription implementa lógica complexa de faturamento, limites de uso e chamada de edge functions em um único arquivo extenso (~430 linhas)
github.com
. Isso dificulta testes e manutenção. A recomendação é extrair serviços separados para manipulação de assinatura e limites, e simplificar o hook para orquestração e estado.

Repetição de validações de variáveis de ambiente (Baixo) – Diversas funções checam SUPABASE_URL, SERVICE_ROLE_KEY, STRIPE_SECRET_KEY etc. O código poderia centralizar verificação de envs e reutilizar um helper para evitar duplicação e garantir falhas claras.

Uso de any e tipos genéricos (Baixo) – Alguns trechos usam any ou cast forçado, diminuindo a segurança de tipos. Por exemplo, response.json() as any em funções Deno. Deve‑se tipar corretamente as respostas e criar interfaces compartilhadas.

Concorrência complexa com locks manuais (Médio) – useSubscription implementa locks baseados em strings para evitar chamadas concorrentes durante a compra ou consumo de tokens
github.com
. Essa abordagem é suscetível a race conditions se o estado for perdido. Uma alternativa é usar transações no banco ou filas (p. ex., row-level locks em Postgres) para garantir atomicidade.

Código de manipulação de arquivos Excel localizado apenas no cliente (Crítico) – O algoritmo de modificação de macros está todo em excel-vba-modifier.ts e roda no navegador, logo o usuário pode adulterar o código e contornar limites. Apesar de ser uma estratégia para reduzir custo de processamento, isso aumenta o risco de vazamento de lógica de negócio. Um modelo mais seguro seria mover a manipulação para uma função de borda protegida ou backend próprio.

Baixa cobertura de testes (Alto) – O workflow de CI (ci.yml) roda npm audit, lint, typecheck e build, mas há poucas evidências de testes automatizados de integração ou unitários. A lógica de assinatura, webhooks e processador Excel são sensíveis e deveriam ser testados.

Verificação de licenças e dependências – Embora npm audit --audit-level=high rode no CI, faltam scanners de licenças ou verificação de compliance legal. Adicionar ferramentas como license-checker e npm audit fix no pipeline seria valioso.

Perguntas pendentes

Para uma avaliação completa, faltam algumas informações:

Banco de dados e RLS – Há regras de acesso do Supabase configuradas? Quais privilégios o serviço usa? Fornecer políticas ajudaria a avaliar proteção contra acesso indevido.

Ambientes e segredos – O repositório não inclui .env por segurança (correto). Qual é a estratégia atual de gerenciamento de segredos (Vercel Environment, Supabase Secrets)? Utilizam secret scanning no GitHub? Caso não, recomenda‑se configurar.

Autenticação multi‑fator – O código suporta TOTP e email, mas falta documentação sobre como forçar MFA, política de senha e rotação de tokens. Quais requisitos de força de senha estão em vigor?

Backups e retenção – Como é feito backup do banco de dados e logs? Há política de retenção para erros em error_logs?

B) Melhorias recomendadas

Refatorar lógica de assinatura – Extrair camadas:

Serviço de assinaturas: encapsular chamadas às funções validate-processing, check-subscription e interação com Stripe. Deixar useSubscription apenas como orquestrador que utiliza o serviço.

Serviço de tokens: encapsular geração e consumo de processing_tokens e contadores.

Modelos TypeScript: criar tipos para planos, estados de assinatura, erro, evitando any.

Organização de pastas – Separar melhor domínio do código: /src/hooks, /src/services, /src/components, /src/pages, /src/utils. Hoje alguns utilitários estão misturados em lib/ e integrations/.

Melhorar logs e observabilidade – Centralizar o logger e unificar padrões de log em cliente e funções (nível, contexto, ID de requisição). Integrar logs de funções no Supabase com uma solução de monitoramento (p. ex., Datadog, Grafana Loki) para análises de produção.

Adicionar docstrings e comentários – Diversos arquivos longos carecem de documentação. Comentar cada função ajuda manutenção e onboarding de novos desenvolvedores.

Automatizar verificação de segredo – Configurar GitHub Secret Scanning e/ou ferramentas como truffleHog para detectar chaves vazadas. Recomendar que colaboradores rodem scanners antes de PR.

E2E e testes unitários:

Unitários: Cobrir excel‑vba‑modifier, useAuth, useSubscription e funções de API. Utilizar Jest ou Vitest.

Integração: Criar testes para o fluxo de assinatura (checkout, webhook), validação de tokens e limites. Podem usar Supabase em localhost ou containers.

E2E: Utilizar Playwright ou Cypress para testar login, upload de arquivo, consumo de token e upgrade de plano.

Gerenciamento de erros e timeouts – Implementar fallback e circuit breaker para chamadas externas (Stripe, Supabase). Exemplo: tempo limite com retry exponencial. A função check-subscription não define timeouts e pode ficar pendurada
github.com
.

Internacionalização – Consolidar strings em arquivos de tradução e assegurar que novas páginas usem t() consistentemente. Atualmente algumas mensagens estão hardcoded.

Hardening do cliente – Remover source maps em produção e ofuscar código sensível. O documento de plano de produção recomenda desativar sourcemaps e ligar Sentry
github.com
.

C) Segurança (OWASP Top 10)

A seguir, riscos identificados (classificados em Crítico/Alto/Médio/Baixo) e sugestões de mitigação:

Severidade	Risco OWASP	Evidência / Arquivo	Mitigação	Impacto
Crítico	Injeção (A1)	O processamento de .xlsm é feito no cliente usando regex/binário sem sanitização. Qualquer manipulação local pode burlar limites, corromper arquivo ou executar scripts maliciosos. A função excel-vba-modifier.ts roda no navegador
github.com
.	Mover o processamento para uma função serverless; validar/ sanitizar entrada no backend; limitar tipo e tamanho de arquivos; usar bibliotecas testadas para manipular planilhas.	Pode permitir execução de código malicioso e quebra de negócio.
Alto	Gerenciamento de autenticação e sessão (A2)	O hook useAuth implementa MFA e escuta eventos, mas não há verificação de força de senha nem expiração de sessão. Falta rotação periódica de refresh tokens.	Configurar políticas de senha no Supabase (minLength, padrões). Definir tempo máximo de sessão e refresh. Forçar MFA para planos pagos.	Credenciais fracas podem ser comprometidas.
Alto	Exposição de dados sensíveis (A3)	Falta de scans automáticos para segredos. O código de funções referencia chaves (SERVICE_ROLE_KEY, STRIPE_SECRET_KEY) e pode vazar se configuradas erroneamente. Planos docs/STRIPE_LIVE_SETUP.md lembram de não versionar .env
github.com
, mas não há enforce.	Usar variáveis de ambiente no Vercel/Supabase com permissões restritas. Ativar secret scanning no GitHub. Configurar CI para falhar se secrets forem detectados.	Vazamento de chaves pode comprometer dados e cobranças.
Médio	Falhas de design (A4)	Lógica de limites e tokens implementada no frontend permite manipulação por usuários avançados. A ausência de verificação de limite no backend até a chamada de validate-processing abre brecha se o cliente for bypassado.	Consolidar a verificação de limites no backend: tokens devem ser gerados e consumidos apenas server‑side. Remover contadores locais.	Usuário pode processar arquivos além do contratado.
Médio	Quebra de controle de acesso (A5)	As funções edge utilizam service_role_key para acessar tabelas sem verificação de usuário. Embora RLS proteja acesso normal, qualquer bug na função pode retornar dados sensíveis.	Adicionar assert explícito de usuário atual e aplicar princípio do menor privilégio. Revisar RLS e conceder permissões específicas para cada tabela.	Vazamento acidental de dados de outros usuários.
Médio	Configuração incorreta de segurança (A6)	Headers de segurança estão bem configurados no vercel.json
github.com
, mas não se verifica se as configurações de CORS nas funções cobrem todos domínios. Funções aceitam origin apenas se houver ALLOWED_ORIGIN; caso contrário podem responder com * em algumas funções.	Revisar todas as funções para garantir que Access-Control-Allow-Origin só aceita domínios previstos. Implementar strict CSP.	Pode permitir que sites maliciosos chamem as APIs.
Baixo	CSRF (A13)	A maioria das requisições é feita via APIs protegidas com tokens, mas o site não define SameSite=Strict para cookies.	Garantir que cookies do Supabase tenham SameSite=Lax/Strict.	Reduz risco de requisições forjadas.
Baixo	Exposição de dados de log (A9)	Os logs armazenados na tabela error_logs podem incluir dados sensíveis (e‑mails, tokens).	Redigir dados sensíveis antes de armazenar; definir retenção e anonimização para logs de erros.	Protege privacidade de usuários.
D) Testes

Cobertura atual: não foram encontrados testes automatizados no repositório. O CI executa lint, typecheck e build
github.com
. Isso deixa a aplicação suscetível a regressões.

Recomendações de testes (prioridade):

Unitários:

excel-vba-modifier.ts: testar casos de sucesso (arquivo válido, padrões encontrados e substituídos) e falha (tipo incorreto, assinatura inválida). Mockar JSZip para validar fluxo.

Hooks: useAuth (login/signup/MFA/erro), useSubscription (cálculo de limites, requisição de token) e useSubscriptionManagement (portal). Use React Testing Library com msw para mockar Supabase e edge functions.

Funções edge: testar validate-processing, check-subscription e webhooks isoladamente usando Deno ou Node com oak/supabase-js de teste; verificar valores de retorno e erros.

Integração:

Fluxo de assinatura: simular criação de conta, escolha de plano, checkout com Stripe (usando Stripe test mode), recebimento de webhook e atualização da assinatura no banco.

Upload e processamento: criar teste que faça upload de .xlsm, receba token, execute processamento e verifique que o arquivo retorna modificado e uso é decrementado.

Auth & 2FA: testar login, reset de senha, MFA em flows completos.

E2E:

Utilizar Playwright ou Cypress para automatizar cenários de usuário final (cadastro, login, upload, upgrade de plano). Configurar testes rodando em staging com Supabase real (via docs de staging
github.com
).

Security tests:

Usar ferramentas de static analysis (SAST) como SonarQube ou ESLint security plugin para detectar injeções e XSS.

Testar rate limiting e log_auth_attempt com alta carga para garantir que falhas de brute force são bloqueadas
github.com
.

E) Checklist de deploy e CI/CD

O repositório contém guias de deploy (RUNBOOK_DEPLOY.md, STAGING.md, STRIPE_LIVE_SETUP.md) e um plano de produção (PLANO_PROD.md). Com base neles e nos pontos levantados, recomenda‑se o seguinte:

Preparação

Configurar ambientes staging e prod no Supabase e Vercel; replicar banco e variáveis de ambiente conforme documentação
github.com
.

Definir variáveis de ambiente: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY (só nas funções), STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ALLOWED_ORIGIN, VITE_SENTRY_DSN. Nunca versionar segredos
github.com
.

Implementar Secret scanning e pre‑commit hooks para impedir commits de segredos.

CI/CD (GitHub Actions)

Lint e Typecheck: já configurado. Adicionar execução de testes unitários e integração.

Segurança: rodar npm audit, trivy para detectar CVEs e truffleHog para escanear segredos.

Build: gerar artefatos com vite build (disable source maps em prod). Usar turbo ou cache para acelerar.

Deploy: utilizar action oficial do Vercel para deploy do frontend; deploy das funções pode ser feito via supabase functions deploy. Incluir migrações do banco (supabase db push) após aprovar PR.

Rollback: manter versões anteriores no Vercel e Supabase; em caso de falhas, usar rollback automático via GitHub Actions (reverter commit).

Observabilidade

Habilitar Sentry (configurar DSN). Ativar captura de erros no cliente e nas funções; garantir que dados sensíveis não sejam enviados.

Configurar monitoramento de uptime nos endpoints de funções (especialmente validate-processing, stripe-webhook e health-check) conforme guia
github.com
. Definir alertas via e‑mail ou Slack.

Coletar métricas de uso (número de tokens consumidos, uploads, falhas) e visualizá-las em dashboard.

Hardening

Habilitar HSTS, CSP, X-Frame-Options (já feito no vercel.json)
github.com
.

Forçar HTTPS e redirecionar HTTP para HTTPS.

Verificar CORS na API para permitir apenas domínios confiáveis.

Configurar Backups diários no Supabase; habilitar retenção de 7–30 dias e política de restauração.

F) Plano de ação em 7 dias
Dia	Tarefas	Objetivos verificáveis
Dia 1 – Levantamento e preparação	- Responder às perguntas pendentes: revisar configurações de RLS, política de senhas e MFA, estratégia de segredos e backups.
- Configurar varredura de segredos no repositório (GitHub Secret Scanning e truffleHog).
- Criar branch de refatoração para separar serviços de assinatura.	Perguntas respondidas; secret scanning ativo; branch criada.
Dia 2 – Refatoração de assinatura	- Extrair classes/serviços de assinatura e tokens de useSubscription para /src/services.
- Criar interfaces TypeScript para planos e estados.
- Ajustar useSubscription para usar o serviço.	PR com serviço separado; testes unitários básicos passando.
Dia 3 – Testes unitários iniciais	- Implementar testes para excel-vba-modifier.ts e useAuth utilizando Vitest/Jest.
- Integrar testes ao workflow de CI.
- Cobrir principais casos de sucesso/erro.	Testes rodando no CI; cobertura mínima (~40%) para esses módulos.
Dia 4 – Segurança e hardening	- Mover processamento de arquivo para função serverless Deno: criar process-file que recebe upload, valida tipo, executa modificação com JSZip e devolve arquivo.
- Implementar política de senha forte no Supabase e exigir MFA para planos pagos.
- Ajustar CORS e cabeçalhos de segurança em todas funções.	Processamento no backend funcionando em ambiente de teste; MFA ativa; cabeçalhos revisados.
Dia 5 – Integração Stripe e webhooks	- Escrever testes de integração para check-subscription e stripe-webhook usando ambiente de testes Stripe.
- Validar cenários de criação de assinatura, upgrade, downgrade e falha de pagamento.
- Revisar stripe-webhook para garantir idempotência e logs.	Testes de integração passando; webhook robusteza validada.
Dia 6 – Observabilidade e CI/CD	- Integrar Sentry no frontend e funções (captação de erros).
- Configurar dashboards de métricas (requisições, tokens consumidos) e monitoramento de uptime.
- Expandir GitHub Actions: adicionar trivy/OWASP scanning, build production sem source maps, deploy automatizado em staging.
- Definir estratégia de rollback.	Sentry reportando erros; pipeline completo em staging; dashboards visíveis.
Dia 7 – Revisão final e lançamento	- Revisar código refatorado e garantir que documentação (ARCHITECTURE.md, RUNBOOK_DEPLOY.md) esteja atualizada.
- Rodar testes E2E em staging (login, upload, upgrade).
- Realizar checklist final de segurança e liberar deploy para produção.	Documentação atualizada; testes E2E com sucesso; deploy para prod concluído.
Conclusão

O projeto Sheet Guardian apresenta uma solução inovadora para remoção de proteção de macros de Excel com assinatura e cobrança. Entretanto, como foi criado com auxílio de IA, há riscos de segurança e problemas estruturais que precisam ser endereçados. A análise destacou a necessidade de centralizar lógica de negócio no backend, melhorar cobertura de testes, adotar padrões de design e fortalecer a segurança. As recomendações e plano de ação fornecem um roteiro concreto para evoluir o aplicativo de forma segura rumo à produção.