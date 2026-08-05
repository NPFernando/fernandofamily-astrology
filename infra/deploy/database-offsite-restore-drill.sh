#!/usr/bin/env bash
# Restore the newest encrypted off-site archive into a temporary directory,
# then use the existing production-refusing drill against that archive.
set -euo pipefail
umask 077

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY must be set}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE must be set}"
: "${RESTORE_DRILL_DATABASE_URL:?RESTORE_DRILL_DATABASE_URL must be set}"

REPO_ROOT="$(pwd -P)"
RESTIC_TAG="${RESTIC_DATABASE_BACKUP_TAG:-fernandofamily-astrology-postgres}"
STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/fernandofamily-restic-drill.XXXXXX")"

cleanup_stage() {
  rm -rf -- "$STAGE_DIR"
}
trap cleanup_stage EXIT

if [[ ! -r "$RESTIC_PASSWORD_FILE" ]]; then
  echo "RESTIC_PASSWORD_FILE is not readable" >&2
  exit 1
fi

restic restore latest --tag "$RESTIC_TAG" --target "$STAGE_DIR"
archive="$(find "$STAGE_DIR" -type f -name 'astrology-*.dump' -print -quit)"
if [[ -z "$archive" || ! -s "$archive" ]]; then
  echo "Off-site restore did not contain a PostgreSQL archive" >&2
  exit 1
fi
pg_restore --list "$archive" >/dev/null

# The archive is outside the local retention directory, but restoring it can
# still only reach a database named astrology_restore_*; the drill checks the
# actual target database before issuing pg_restore --clean.
RESTORE_DRILL_ALLOW_EXTERNAL_ARCHIVE=1 \
  bash "$REPO_ROOT/infra/deploy/database-restore-drill.sh" "$archive"

echo "Off-site database restore drill succeeded"
