Plano de Execução de QA e Confiabilidade - Sheet Guardian
Destinatário: Claude / Equipe de Engenharia
Objetivo: Garantir a estabilidade, segurança e prontidão para produção da aplicação Sheet Guardian (Vercel + Supabase).
Função: QA Lead & SRE
1. Verificações Estáticas e de Build (P0) - CONCLUÍDO ✅
Status Final: Build estável, Secrets seguros, Risco de auditoria aceito.
2. Testes Automatizados (Code Level) - CONCLUÍDO ✅
Status Final: 19 Testes passando. Script de QA do Webhook (Deno) APROVADO.
2.1 a 2.5. Infraestrutura e Schema - CONCLUÍDO ✅
Status Final:
Deploy da Edge Function: Sucesso.
Sincronização de Banco: Resolvida via Docker.
Arquivo de Verdade: 20251231124046_remote_schema.sql.
Status Geral: migration list sincronizado e db push limpo.
3. Matriz de Riscos e Testes Manuais/E2E (EM EXECUÇÃO) 🚀
Agora que o código e o banco conversam a mesma língua, vamos testar se o produto funciona para o usuário final.
3.1. Execução dos Cenários Críticos
Ação para o Agente: Execute os passos abaixo manualmente (abrindo a aplicação) ou via script onde indicado, e relate o resultado.
Cenário A: Upload e Desbloqueio (Fluxo Core)
Objetivo: Garantir que a promessa principal do produto funciona.
Setup: Abra a aplicação em ambiente local (npm run dev) ou Preview.
Ação: Faça upload de um arquivo .xlsm válido (com senha VBA).
Verificações (Checklist):
[ ] A UI mostra progresso (Barra de progresso/Spinner)?
[ ] O download do arquivo desbloqueado inicia automaticamente?
[ ] O arquivo baixado abre no Excel sem pedir senha no editor VBA?
[ ] Verificação de Banco: Verifique se o contador do seu usuário aumentou:
select files_processed_total from profiles where id = 'SEU_USER_ID';
Cenário B: Limite de Plano Free (Segurança de Negócio)
Objetivo: Garantir que ninguém usa o serviço de graça além do permitido.
Setup: Force o limite no banco para o seu usuário de teste.
SQL: update profiles set files_processed_total = 5, subscription_tier = 'free' where id = 'SEU_USER_ID'; (Assumindo limite de 3 ou 5).
Ação: Tente fazer upload de um novo arquivo.
Verificações:
[ ] A UI bloqueia o upload e exibe o modal de Upgrade?
[ ] Segurança (Network): Nenhuma requisição pesada é enviada se a UI bloquear.
Cenário C: Webhook Real & Idempotência (Integração)
Objetivo: Garantir que pagamentos não quebram o sistema e não são contados em dobro.
Setup: Tenha o ID de um cliente/usuário existente no banco (auth.users).
Ação 1 (Primeiro Disparo): Use o Deno ou Stripe CLI para enviar um evento checkout.session.completed para a URL da sua Edge Function.
Payload Mock: Use o script stripe-webhook.qa.ts ajustado para apontar para a URL remota (ou local via túnel).
Ação 2 (Segundo Disparo - Duplicado): Envie EXATAMENTE o mesmo payload (mesmo ev_id).
Verificações:
[ ] Disparo 1: Resposta HTTP 200 OK. Tabela subscriptions atualizada.
[ ] Disparo 2: Resposta HTTP 200 OK. Logs do Supabase mostram "Event already processed". Nenhum erro SQL.
4. Checklist de Produção (Infra & Config)
4.1. Variáveis de Ambiente
Variável
Status
STRIPE_WEBHOOK_SECRET
CRÍTICO: Verificar se bate com o Stripe Dashboard

4.2. Banco de Dados
[ ] Verificar tabela criada: select count(*) from stripe_webhook_events; (Deve retornar 0 ou mais, sem erro).
5. Procedimentos de Operação
5.1. Plano de Rollback
Frontend: Vercel Rollback.
Backend (Function): supabase functions deploy ... (Versão anterior).
Dados: 20251231124046_remote_schema.sql é o ponto de restauração seguro agora.
Assinatura:
QA Lead / SRE
Data: 31/12/2025
