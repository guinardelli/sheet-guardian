Diagnóstico da Stack & Arquitetura
Tecnologias detectadas
A inspeção do repositório sheet‑guardian mostrou que o projecto é uma aplicação SaaS composta por um front‑end em React e um back‑end serverless em Supabase/Stripe. Abaixo estão as principais tecnologias detectadas:
Camada	Tecnologia/Versão	Evidências
Front‑end	React 18 com TypeScript, bundler Vite, UI com Tailwind CSS e componentes do Radix UI. Utiliza react‑router para rotas, React‑Hook‑Form, i18n para internacionalização, Sentry para rastreamento de erros, Resend para e‑mails e Supabase JS SDK para autenticação e chamadas a funções edge.	Arquivos src/App.tsx e src/main.tsx mostram importação de react/react‑router, inicialização de Sentry e renderização do App. O src/services/supabase/client.ts cria cliente do Supabase com chave pública de ambiente.
Back‑end	Supabase como banco de dados e serviço de autenticação. Funções Edge escritas em Deno/Typescript dentro do diretório supabase/functions/. Algumas funções interagem com Stripe (pagamentos), Resend (e‑mails) e jszip (processamento de macros).	O arquivo supabase/functions/process-file/index.ts decodifica arquivos .xlsm, altera padrões maliciosos e retorna o arquivo, usando jszip. As funções check-subscription, create-checkout, customer-portal, validate-processing, cleanup-tokens, health-check e stripe-webhook interagem com o Supabase e Stripe.
Ambiente/Infra	Configuração utilizando Supabase (via env.ts) e variáveis de ambiente para chaves públicas e de serviço; Dockerfile ausente, portanto utiliza‑se Vercel/Supabase para deployment. Testes escritos em Deno (arquivos .qa.ts).	O arquivo env.ts lê variáveis como SUPABASE_URL, SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, etc., e lança erro se estiverem ausentes[1].

Arquitetura e Fluxo de dados
A aplicação adopta uma arquitetura SPA (Single‑Page Application) com um back‑end serverless. O fluxo de dados principal é:
1.	Usuário acede à SPA construída em React.
2.	O front‑end usa o cliente Supabase para autenticar o usuário via e‑mail/senha; o AuthProvider escuta mudanças na sessão e aplica rate‑limit via RPC.
3.	Após login, o front‑end invoca funções Edge de Supabase utilizando um token JWT (bearer), por exemplo validate-processing, process-file, check-subscription.
4.	As funções Edge utilizam a chave de serviço (service_role) para consultas privilegiadas no Supabase e para comunicação com serviços externos (Stripe, Resend, jszip). A função process-file recebe um arquivo .xlsm e substitui padrões de macros maliciosas antes de retornar o arquivo modificado.
5.	Para pagamentos, o front‑end invoca create-checkout para criar sessão no Stripe, e customer-portal para gerir billing. A função stripe-webhook recebe eventos do Stripe e actualiza as assinaturas no Supabase.
6.	Logs e métricas são enviados ao Sentry e os e‑mails são enviados pelo Resend.
Diagrama de fluxo (Mermaid)
graph TD
  A[Usuário no Browser] -->|login/registro| B(SPA React)
  B -->|auth via Supabase JS| C{Supabase Auth}
  C -->|JWT de sessão| B
  B -->|invoca função Edge| D[validate-processing]
  B -->|upload .xlsm| E[process-file]
  D -->|consulta db com service\_role| F[Supabase DB]
  E -->|usa jszip; substitui macros| G[Arquivo sanitizado]
  B -->|inicia checkout| H[create-checkout]
  H -->|cria sessão| I[Stripe API]
  I -->|webhooks| J[stripe-webhook]
  J --> F
  B -->|abre portal| K[customer-portal]
  B -->|recebe token e paga| B
  F -->|usa Resend| L[Envio de email]
Esse diagrama simplifica o fluxo de autenticação/processamento: o usuário interage com a SPA, obtém um JWT do Supabase e invoca funções Edge que usam a chave de serviço para acessar o banco ou serviços externos.
Análise da Stack e observações
•	Monorepo pequeno: grande parte da lógica de negócio está nas funções Edge. O front‑end atua apenas como orchestrador das chamadas e exibe UI.
•	Acoplamento vertical: várias funções repetem código de configuração (CORS, validação de token, leitura de variáveis) e detêm lógica crítica (por exemplo, cálculo de limites de uso) que poderia ser centralizada em módulos reutilizáveis.
•	Ausência de Dockerfile: não há um container oficial; presumivelmente o projeto é implantado via Vercel/Supabase com CI mínimo. Isso dificulta a padronização de ambientes e a configuração de hardening.
Relatório de Segurança (Prioridades)
A auditoria aplicou os princípios da OWASP Top 10:2025. Cada vulnerabilidade encontrada foi classificada com severidade (CRÍTICO, ALTO, MÉDIO, BAIXO) conforme probabilidade de exploração e impacto. Para cada item há o caminho do arquivo, descrição e proposta de correção. As citações de OWASP justificam a importância de cada mitigação.
Vulnerabilidades Críticas
Arquivo / Componente	Problema (com justificativa)	Correção sugerida
supabase/functions/validate-processing/index.ts (e demais funções)	Uso de chave de serviço (service_role) em funções públicas — as funções Edge autenticam o usuário com o token recebido, mas internamente utilizam a service_role para consultar e modificar tabelas. Essa chave tem privilégios administrativos, e se vazada possibilita acesso total ao banco. O OWASP alerta que “usar credenciais ou chaves estáticas em código ou configuração expõe o sistema; deve‑se usar mecanismos de identidade, credenciais de curta duração ou secrets fora do código”[2].
Remover chave de serviço do runtime público. Criar funções com políticas RLS (Row Level Security) que operem com o supabase anon key do usuário autenticado; implementar triggers ou procedures no banco para a lógica de limites/planos. Usar Supabase JWT do usuário para todas as consultas e aplicar RLS para garantir que cada usuário só acesse seus dados. Para ações administrativas (p.ex. atualizar assinaturas) usar API em ambiente seguro (cron job) e variáveis secretas no servidor, nunca expostas ao front‑end.
supabase/functions/process-file/index.ts	Processamento de macros e manipulação de arquivos no servidor sem verificação de assinatura ou origem. A função extrai e modifica vbaProject.bin substituindo padrões CMG, DPB e GC, mas não verifica se o arquivo provém de fonte confiável. Segundo o OWASP, falhas de integridade ocorrem quando “dados ou software de origem não confiável são tratados como válidos”[3], e é necessário validar assinaturas digitais ou checksums[4].
Implementar verificação de integridade: exigir que uploads sejam assinados digitalmente pelo cliente com chave privada e verificar assinatura antes de modificar. Usar bibliotecas que removam macros maliciosas por completo (por exemplo, oletools ou anti‑virus). Caso não seja possível, mover o processamento para serviço de sandbox isolado e limitar tamanho e tipo de arquivos.
supabase/functions/cleanup-tokens/index.ts	Endpoint exposto sem autenticação para exclusão de tokens. A função responde a GET e POST e simplesmente remove tokens expirados usando a chave de serviço. Qualquer pessoa pode invocá‑la e causar negação de serviço removendo tokens em uso.	Tornar o endpoint restrito: aplicar validação JWT e permissões. Implementar rota interna (job agendado) que roda em ambiente confiável.
supabase/functions/health-check/index.ts	Exposição de informações sensíveis: a função retorna o número de usuários sem assinatura, status de saúde e detalhes de planos. O OWASP alerta que a exposição de informações internas através de logs ou mensagens de erro é parte de “security misconfiguration”[5].
Limitar a saída do health‑check a “ok”/“error” sem revelar dados de usuários. Usar cabeçalhos HTTP apropriados e esconder contagens.
Geral (CORS)	CORS restrito a dois domínios hard‑codados (https://vbablocker.vercel.app e http://localhost:8080). Se a aplicação for usada em outro domínio ou subdomínio, as requisições serão bloqueadas, e desenvolvedores podem remover o check por conveniência, abrindo a API a qualquer origem. OWASP considera configurações incorretas um dos principais riscos[5].
Mover a configuração de CORS para variável de ambiente. Implementar validação dinâmica de origem com lista de domínios permitidos configurável. Para testes locais, usar domínios específicos.
Front‑end useAuth.tsx	Rate‑limit baseado apenas em IP: a função RPC check_rate_limit usa IP para limitar tentativas. Ataques distribuídos podem facilmente contornar limites usando IPs diferentes. Adicionalmente, a implementação não bloqueia automaticamente após múltiplas tentativas falhas. O OWASP recomenda bloquear ou retardar tentativas e emitir alertas【796922645979889†L145-L173】.	Implementar limite progressivo por usuário e IP, usando token/contador no banco. Após X tentativas falhas, exigir captcha ou MFA. Registrar falhas em logs centralizados.
Segurança das Sessões (front‑end e funções)	Verificação incompleta de tokens JWT: as funções assumem que o Authorization: Bearer é válido e não verificam campos aud ou iss. O OWASP recomenda validar aud e iss e gerar novos session IDs com alta entropia[6].
Criar middleware que decodifique e valide o JWT usando a biblioteca oficial, verificando audience, issuer e escopos. Invalidar sessões quando expiradas.
Vulnerabilidades de Alta Severidade
Arquivo / Componente	Problema	Correção
supabase/functions/check-subscription/index.ts & create-checkout/index.ts	Mapeamento estático de IDs de produtos/preços. O código mapeia preços Stripe para produtos específicos e rejeita outros. Invasores poderiam enviar priceId alternativo para contratar um plano mais barato ou gratuito.	Manter o mapeamento no servidor seguro ou no banco de dados. Validar que o priceId recebido pertence ao plano solicitado pelo usuário.
validate-processing/index.ts	Função complexa com lógica de limites e geração de tokens sem rate‑limit. Qualquer usuário autenticado pode requisitar tokens indefinidamente (uso action=validate) e então consumir tokens em loop (action=consume), potencialmente contornando limites.	Separar a lógica: criar uma função para geração de tokens com verificação de saldo e outra para consumo que deleta/expira token após uso. Implementar contador transacional no banco com colunas remaining, consumed e triggers.
stripe-webhook/index.ts	Falta de verificação de reexecução/replay: apesar do código tentar registrar eventos, a lógica de idempotência está vulnerável. Um atacante pode reexecutar webhooks e forçar múltiplas atualizações ou reembolsos.	Utilizar replay protection verificando Stripe-Signature e armazenando os event.id processados em tabela com unique e TTL. Rejeitar eventos já processados.
process-file/index.ts	Falta de validação de extensão MIME e tamanho: a função verifica extensão .xlsm e assinatura ZIP, porém aceita arquivos muito grandes e não verifica MIME. Isso pode levar a consumo de recursos ou Zip Bomb.	Limitar tamanho (p.ex. 10 MB), verificar cabeçalho MIME, recusar tipos desconhecidos.
useAuth.tsx	Mensagens diferentes para erros: ao autenticar, a função exibe mensagens distintas (usuário inexistente vs senha incorreta), possibilitando enumeração de contas. OWASP recomenda retornar mensagens uniformes nas falhas[7].
Exibir sempre “Usuário ou senha inválidos”. Registrar detalhes apenas em logs internos.
Gerenciamento de Erros	Exposição de detalhes em respostas JSON: várias funções retornam mensagens de erro com detalhes técnicos (e.g., stacktrace, mensagem de exceção). OWASP considera o vazamento de mensagens detalhadas um caso de misconfiguração[5].
Substituir por mensagens genéricas e registrar detalhes internamente.
Vulnerabilidades de Média Severidade
Arquivo / Componente	Problema	Correção
src/services/subscriptionService.ts & useSubscription.tsx	Retry exponencial sem limite: a função invokeFunctionWithRetry tenta indefinidamente e pode levar a loops infinitos.	Adicionar limite de tentativas e fallback com mensagens de erro amigáveis.
supabase/functions/process-file/index.ts	Sanitização frágil de macros: a função apenas substitui sequências de bytes fixos. Macros maliciosas podem usar outros padrões ou ofuscação.	Utilizar biblioteca antivírus ou sandbox para analisar macros, ou converter o arquivo para formato seguro (CSV) eliminando macros completamente.
CORS & Security Headers	Cabeçalhos de segurança ausentes: as funções definem apenas CORS. Não enviam Content-Security-Policy, Strict-Transport-Security ou X-Content-Type-Options.	Configurar cabeçalhos de segurança para cada resposta.
Logs	Logs locais não estruturados e sem rotação: a função logger.ts imprime no console do edge function; não há persistência ou centralização. Falhas podem passar despercebidas, e o OWASP alerta que ausência de logs e alertas impede a detecção de ataques[8].
Implementar logging estruturado (JSON) com correlação de requisição e enviar logs a um serviço central (Supabase Logflare, Datadog, ELK).
Vulnerabilidades de Baixa Severidade / Hardening
•	Tokens de processamento com tempo de vida longo (24 h) — diminuir o TTL e armazenar o token de forma criptografada.
•	Falta de CSP no front‑end — configurar Content-Security-Policy para restringir recursos externos.
•	Ausência de MFA — A OWASP recomenda MFA para mitigar ataques de credenciais[9].
•	Dependências sem verificação de integridade — o package.json não trava versões. Aplicar npm ci e npm audit em CI.
Code Smells & Refatoração
A análise identificou diversos pontos que dificultam a manutenção e violam princípios SOLID/DRY:
•	Funções gigantes e acopladas: validate-processing/index.ts e process-file/index.ts possuem centenas de linhas e misturam validação de parâmetros, lógica de negócio e manipulação de arquivos. Isso viola o princípio de responsabilidade única. Refatoração: extrair sub‑funções (por exemplo, getUserSubscription(), checkLimits(), generateToken()) e criar bibliotecas reutilizáveis.
•	Repetição de código de CORS e cabeçalhos: todas as funções implementam manualmente verificação de origem e montagem de cabeçalhos. Criar módulo compartilhado (cors.ts) e importá‑lo.
•	Validação dispersa de JWT: cada função faz sua própria verificação. Criar middleware comum (withAuth(handler)) que decodifica e valida o token, verificando aud e iss[6].
•	Mapeamentos estáticos (ALLOWED_PRICE_TO_PRODUCT, PLAN_LIMITS): essas tabelas ficam em arquivos de código. Aumentar a escalabilidade movendo‑as para o banco de dados com CRUD administrativo.
•	Dependência de IP para rate limiting: useAuth.tsx usa apenas IP. Adicionar identificador de usuário e usar buckets centralizados.
•	Inconsistência de erros: exceções são capturadas com mensagens distintas, alguns retornos em 500, outros em 400. Centralizar tratamento de erros.
•	Falta de modularização no front‑end: componentes pequenos (ex. Authentication, Dashboard) poderiam ser separados em pastas próprias com hooks e serviços, seguindo Clean Architecture.
Guia de Produção (DevOps & SRE)
Docker
•	Imagem multi‑stage: criar um Dockerfile para o front‑end e outro para as funções Edge. Utilizar uma base oficial (node:20‑alpine para build e nginx:alpine para servir) e rodar como usuário não‑root. Exemplo:
# Stage de build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm ci
COPY . .
RUN npm run build

# Stage de produção
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
RUN addgroup -S app && adduser -S app -G app
USER app
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
•	Variáveis de ambiente: nunca versionar chaves; usar docker secrets ou variáveis injetadas via plataforma (Vercel/Supabase) com escopos mínimos. Separar variáveis por ambiente (dev/staging/prod)[10].
•	Pacotes e permissões: remover utilitários desnecessários (curl, git) da imagem final e aplicar chmod adequado aos arquivos. Adicionar healthcheck no container.
CI/CD (GitHub Actions)
Crie um pipeline YAML com etapas:
1.	Checkout & Instalação: usar actions/checkout e actions/setup-node, cachear dependências.
2.	Lint & Formatação: executar ESLint e Prettier.
3.	SAST/Secret scanning: rodar npm audit, trivy e gitleaks para detectar vulnerabilidades e chaves expostas.
4.	Testes unitários e QA: rodar testes com pnpm run test e testes de funções Edge com Deno (arquivos .qa.ts). Incluir testes de integração com Supabase (em ambiente de staging).
5.	Build: rodar pnpm run build e docker build para gerar imagens.
6.	Deploy: se estiver em main, publicar a imagem no registro e fazer deploy via Vercel/Supabase. Configurar branch protection.
Observabilidade
•	Logs estruturados: usar JSON para logs (campos timestamp, level, message, userId) e enviá‑los a uma stack de logs (Logflare/Sentry/Datadog). Evitar registrar dados sensíveis[11].
•	Métricas: monitorar número de arquivos processados, tokens emitidos, erros de assinatura, latência das funções e contagem de assinaturas. Expor métricas via Prometheus ou Supabase.
•	Alertas: configurar alertas para falhas de autenticação, picos de uso e eventos de Stripe. Seguir recomendações do OWASP para definir thresholds e playbooks de resposta[8].
Testes Necessários
Além dos testes existentes, sugere‑se:
•	Testes unitários: para funções de cálculo de limites (checkLimits), geração e consumo de tokens, verificação de assinatura de arquivos, mapeamento de planos.
•	Testes de integração: invocar as funções Edge em ambiente de staging com diferentes cenários de assinatura (gratis, mensal, anual), simulando webhooks do Stripe e verificando se o estado do banco é atualizado corretamente.
•	Testes de segurança (fuzzing): usar ferramentas como ZAP ou DAST para enviar payloads maliciosos, testando injeções e XSS. A OWASP recomenda validação positiva e escapes para prevenir injecção[12].
•	Edge cases que quebram o app:
•	Enviar arquivo .xlsm com macros ofuscadas (padrões diferentes de CMG/DPB/GC). O app deveria recusar ou sanitizar. Sem correção, ele aceitará o arquivo e não removerá a macro maliciosa.
•	Solicitar tokens repetidamente com action=validate e em seguida consumir via action=consume, excedendo os limites de uso semanal. A função não trava após múltiplos tokens.
•	Manipular priceId no front‑end para contratar plano mais barato. Se o servidor confiar no valor, criará assinatura incorreta.
Plano de Ação (7 dias)
Dia	Atividades
1–2: Segurança e Hotfixes	Remover dependência da chave de serviço: implementar RLS no Supabase e ajustar funções para usar apenas o token do usuário. Adicionar middleware de autenticação e validar aud/iss e escopos. Corrigir endpoint cleanup‑tokens para exigir autenticação. Configurar CORS dinâmico. Limitar mensagens de erro.
3–4: Refatoração e Testes	Modularizar funções Edge (extraindo lógica de limites, tokens e CORS). Criar biblioteca compartilhada para validação JWT. Criar testes unitários e integração para os serviços críticos. Implementar sanitização robusta para macros ou mover processamento para serviço externo.
5–6: Infraestrutura & Docker/CI	Criar Dockerfiles multi‑stage para front‑end e back‑end. Configurar pipeline GitHub Actions com lint, testes, SAST e build de imagem. Definir variáveis de ambiente via secrets. Configurar cabeçalhos de segurança (CSP, HSTS).
7: Deploy & Monitoramento	Implantar versão refatorada em ambiente de staging. Configurar logs estruturados, métricas e alertas. Realizar revisão final de segurança (pentest leve) antes de promover para produção. Treinar a equipe sobre novos processos de CI/CD e práticas seguras.
________________________________________
[1] env.ts
https://github.com/guinardelli/sheet-guardian/blob/10f5a54f1a3504f2cd183f7d04bdb75e0fad789b/supabase/functions/_shared/env.ts
[2] [5] [10] A02 Security Misconfiguration - OWASP Top 10:2025
https://owasp.org/Top10/2025/A02_2025-Security_Misconfiguration/
[3] [4] A08 Software or Data Integrity Failures - OWASP Top 10:2025
https://owasp.org/Top10/2025/A08_2025-Software_or_Data_Integrity_Failures/
[6] [7] [9] A07 Authentication Failures - OWASP Top 10:2025
https://owasp.org/Top10/2025/A07_2025-Authentication_Failures/
[8] [11] A09 Security Logging and Alerting Failures - OWASP Top 10:2025
https://owasp.org/Top10/2025/A09_2025-Security_Logging_and_Alerting_Failures/
[12] A05 Injection - OWASP Top 10:2025
https://owasp.org/Top10/2025/A05_2025-Injection/
