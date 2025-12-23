#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_DB_URL:?Missing SUPABASE_DB_URL (postgres connection string)}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "${BACKUP_DIR}"

STAMP="$(date +%Y%m%d_%H%M%S)"
FILE="${BACKUP_DIR}/supabase_backup_${STAMP}.dump"

pg_dump --format=custom --file "${FILE}" "${SUPABASE_DB_URL}"
echo "Backup created: ${FILE}"
