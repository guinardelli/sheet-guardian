# Estratégia de Backup e Recuperação — Sheet Guardian

Para garantir a continuidade do serviço e a segurança dos dados dos usuários, seguimos a seguinte estratégia de backup:

## 1. Supabase Point-In-Time Recovery (PITR)
- **O que é**: Permite restaurar o banco de dados para qualquer segundo específico nos últimos 7 a 28 dias (dependendo do plano Supabase).
- **Como usar**:
  1. Acesse o Supabase Dashboard -> Project Settings -> Database.
  2. Vá em "Backups" e selecione "Restore to a point in time".
  3. Escolha a data e hora desejadas.

## 2. Backups Estruturais (Migrações)
- **O que é**: Todo o esquema do banco de dados (tabelas, RLS, funções, triggers) está versionado na pasta `/supabase/migrations`.
- **Prevenção**: Nenhuma alteração de esquema deve ser feita manualmente via Dashbord; sempre use migrações SQL para garantir que o ambiente possam ser reconstruído do zero.

## 3. Exportação Manual (Mensal)
- **O que é**: Exportação em CSV/SQL dos dados críticos (`subscriptions`, `usage_logs`).
- **Comando sugerido**:
  ```bash
  supabase db dump --data-only -f backup_data_$(date +%Y%m%d).sql
  ```

## 4. Recuperação de Desastre (DR)
Em caso de falha total da região do Provedor (AWS/Supabase):
1. Criar novo projeto Supabase.
2. Aplicar todas as migrações (`supabase db push`).
3. Restaurar dados do último backup manual se o PITR não estiver disponível.
4. Atualizar as variáveis de ambiente no Vercel (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

---
**Responsável**: CTO / Tech Lead
**Última Revisão**: 16/01/2026
