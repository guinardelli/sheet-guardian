# Backup and Restore

## Prerequisites
- `pg_dump` and `pg_restore` available in your PATH
- `SUPABASE_DB_URL` set to the target Postgres connection string
- Optional: `BACKUP_DIR` to override the default `./backups`

## Backup
Run the existing script:

```bash
./backup.sh
```

It will create a timestamped `.dump` file under `./backups`.

## Restore
Pick the `.dump` file you want to restore and run:

```bash
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname "$SUPABASE_DB_URL" \
  "./backups/supabase_backup_YYYYMMDD_HHMMSS.dump"
```

Notes:
- `--clean` + `--if-exists` will drop existing objects before restoring them.
- This will overwrite data in the target database. Verify you are pointing to the correct environment.
