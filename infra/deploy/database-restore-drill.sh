#!/usr/bin/env bash
# Restore the newest verified archive into a dedicated disposable database and
# check its schema. This MUST NEVER target the production database.
set -euo pipefail
umask 077

: "${ASTROLOGY_DATABASE_URL:?ASTROLOGY_DATABASE_URL must be set}"
: "${RESTORE_DRILL_DATABASE_URL:?RESTORE_DRILL_DATABASE_URL must be set}"

REPO_ROOT="$(pwd -P)"
BACKUP_DIR_INPUT="${ASTROLOGY_BACKUP_DIR:-$REPO_ROOT/.backups/postgres}"

if [[ ! -d "$BACKUP_DIR_INPUT" ]]; then
  echo "Backup directory does not exist; run database-backup.sh first" >&2
  exit 1
fi
BACKUP_DIR="$(realpath -e -- "$BACKUP_DIR_INPUT")"
if [[ "$BACKUP_DIR" == "/" || "$BACKUP_DIR" == "$REPO_ROOT" ]]; then
  echo "Refusing unsafe backup directory" >&2
  exit 1
fi

select_latest_backup() {
  local newest=""
  local candidate
  while IFS= read -r -d '' candidate; do
    if [[ -z "$newest" || "$candidate" -nt "$newest" ]]; then
      newest="$candidate"
    fi
  done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'astrology-*.dump' -print0)
  printf '%s' "$newest"
}

if [[ "$#" -gt 1 ]]; then
  echo "usage: database-restore-drill.sh [backup-file]" >&2
  exit 2
fi

requested_backup="${1:-$(select_latest_backup)}"
if [[ -z "$requested_backup" || ! -f "$requested_backup" ]]; then
  echo "No verified database backup is available for a restore drill" >&2
  exit 1
fi
backup_path="$(realpath -e -- "$requested_backup")"
if [[ "${RESTORE_DRILL_ALLOW_EXTERNAL_ARCHIVE:-0}" != "1" ]]; then
  case "$backup_path" in
    "$BACKUP_DIR"/astrology-*.dump) ;;
    *)
      echo "Restore drills accept only generated archives inside the backup directory" >&2
      exit 1
      ;;
  esac
fi
pg_restore --list "$backup_path" >/dev/null

production_database="$(psql --no-psqlrc --dbname="$ASTROLOGY_DATABASE_URL" -Atqc 'SELECT current_database()' | tr -d '[:space:]')"
drill_database="$(psql --no-psqlrc --dbname="$RESTORE_DRILL_DATABASE_URL" -Atqc 'SELECT current_database()' | tr -d '[:space:]')"

if [[ -z "$production_database" || -z "$drill_database" || "$production_database" == "$drill_database" ]]; then
  echo "Restore drill database must be reachable and different from production" >&2
  exit 1
fi
if [[ ! "$drill_database" =~ ^astrology_restore_[a-z0-9_]+$ ]]; then
  echo "Restore drill database name must start with astrology_restore_" >&2
  exit 1
fi

# --clean intentionally destroys only the disposable drill database contents.
# The database-name check above is a fail-closed guard against production use.
pg_restore \
  --dbname="$RESTORE_DRILL_DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  "$backup_path"

required_tables="$(psql --no-psqlrc --dbname="$RESTORE_DRILL_DATABASE_URL" -Atqc "
  SELECT count(*)
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('profiles', 'preferences', 'push_subscriptions', 'push_sent')
" | tr -d '[:space:]')"
if [[ "$required_tables" != "4" ]]; then
  echo "Restore drill completed but expected application tables are missing" >&2
  exit 1
fi

echo "Database restore drill succeeded: $(basename -- "$backup_path") -> $drill_database"
touch "$BACKUP_DIR/.restore-drill-last-success"
