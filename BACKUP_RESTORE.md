# Backup restore

## Objetivo
Documentar o procedimento de restore e registrar resultados.

## Pre-requisitos
- Postgres local ou projeto Supabase vazio para restauracao.
- `pg_restore` disponivel.

## Passos
1) Obter o arquivo de backup (GitHub Actions artifact ou ./backups).
2) Criar banco alvo.
3) Restaurar:
   pg_restore --clean --no-owner --dbname <URL_POSTGRES> <ARQUIVO.dump>
4) Validar dados basicos (contagens, tabelas criticas).
5) Registrar em `docs/BACKUP_TEST_LOG.md`.

## Exemplo
pg_restore --clean --no-owner --dbname postgresql://user:pass@host:5432/db backups/supabase_backup_YYYYMMDD.dump

## Dicas
- Execute em ambiente isolado.
- Nao use producao como alvo.
