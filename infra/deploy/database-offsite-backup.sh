#!/usr/bin/env bash
# Encrypt and replicate one verified local PostgreSQL archive with Restic.
# Restic supports S3-compatible endpoints (including OCI Object Storage), S3,
# Backblaze, and many other providers through operator-supplied configuration.
set -euo pipefail
umask 077

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY must be set}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE must be set}"

REPO_ROOT="$(pwd -P)"
BACKUP_DIR_INPUT="${ASTROLOGY_BACKUP_DIR:-$REPO_ROOT/.backups/postgres}"
RESTIC_TAG="${RESTIC_DATABASE_BACKUP_TAG:-fernandofamily-astrology-postgres}"

if [[ ! -r "$RESTIC_PASSWORD_FILE" ]]; then
  echo "RESTIC_PASSWORD_FILE is not readable" >&2
  exit 1
fi
if [[ ! -d "$BACKUP_DIR_INPUT" ]]; then
  echo "Backup directory does not exist; run database-backup.sh first" >&2
  exit 1
fi
BACKUP_DIR="$(realpath -e -- "$BACKUP_DIR_INPUT")"
if [[ "$BACKUP_DIR" == "/" || "$BACKUP_DIR" == "$REPO_ROOT" ]]; then
  echo "Refusing unsafe backup directory" >&2
  exit 1
fi

latest_backup=""
while IFS= read -r -d '' candidate; do
  if [[ -z "$latest_backup" || "$candidate" -nt "$latest_backup" ]]; then
    latest_backup="$candidate"
  fi
done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'astrology-*.dump' -print0)

if [[ -z "$latest_backup" ]]; then
  echo "No verified database backup is available for off-site replication" >&2
  exit 1
fi

restic backup --tag "$RESTIC_TAG" "$latest_backup"
restic forget \
  --tag "$RESTIC_TAG" \
  --keep-daily "${RESTIC_KEEP_DAILY:-14}" \
  --keep-weekly "${RESTIC_KEEP_WEEKLY:-8}" \
  --keep-monthly "${RESTIC_KEEP_MONTHLY:-12}" \
  --prune
# Validate repository structure after every upload without reading archive
# contents. A separate monthly off-site restore drill verifies restorability.
restic check

echo "Off-site database backup replicated: $(basename -- "$latest_backup")"
