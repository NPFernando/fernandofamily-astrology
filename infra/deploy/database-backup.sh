#!/usr/bin/env bash
# Create a verified, PostgreSQL custom-format backup of account preferences,
# profiles, and push subscriptions. This script deliberately requires its DSN
# in the environment so it never parses or prints a production .env file.
set -euo pipefail
umask 077

: "${ASTROLOGY_DATABASE_URL:?ASTROLOGY_DATABASE_URL must be set}"

REPO_ROOT="$(pwd -P)"
BACKUP_DIR_INPUT="${ASTROLOGY_BACKUP_DIR:-$REPO_ROOT/.backups/postgres}"
RETENTION_DAYS="${ASTROLOGY_BACKUP_RETENTION_DAYS:-14}"

if [[ ! "$RETENTION_DAYS" =~ ^[1-9][0-9]{0,3}$ ]]; then
  echo "ASTROLOGY_BACKUP_RETENTION_DAYS must be a positive integer" >&2
  exit 1
fi

mkdir -p -- "$BACKUP_DIR_INPUT"
BACKUP_DIR="$(realpath -e -- "$BACKUP_DIR_INPUT")"
if [[ "$BACKUP_DIR" == "/" || "$BACKUP_DIR" == "$REPO_ROOT" ]]; then
  echo "Refusing unsafe backup directory" >&2
  exit 1
fi
chmod 700 -- "$BACKUP_DIR"

# Avoid overlapping timers deleting/overwriting each other's artifacts.
exec 9>"$BACKUP_DIR/.backup.lock"
if ! flock -n 9; then
  echo "A database backup is already running; leaving the existing backup untouched." >&2
  exit 0
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
final_path="$BACKUP_DIR/astrology-$timestamp.dump"
partial_path="$BACKUP_DIR/.astrology-$timestamp.dump.partial.$$"

cleanup_partial() {
  if [[ -e "$partial_path" ]]; then
    rm -f -- "$partial_path"
  fi
}
trap cleanup_partial EXIT

pg_dump \
  --dbname="$ASTROLOGY_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$partial_path"

if [[ ! -s "$partial_path" ]]; then
  echo "Database backup did not produce an archive" >&2
  exit 1
fi

# Parse the archive before it becomes an eligible restore point. pg_restore
# writes only its table-of-contents to stdout, which is discarded here so no
# account data or subscription endpoints enter logs.
pg_restore --list "$partial_path" >/dev/null
mv -- "$partial_path" "$final_path"
chmod 600 -- "$final_path"

# Only generated custom archives inside the resolved backup directory are
# eligible for retention cleanup. Partial files are never selected here.
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'astrology-*.dump' -mtime "+$RETENTION_DAYS" -delete

echo "Database backup created: $(basename -- "$final_path")"
