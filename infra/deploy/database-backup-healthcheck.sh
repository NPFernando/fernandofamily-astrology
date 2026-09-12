#!/usr/bin/env bash
# Fail when scheduled backups or restore drills have not completed recently.
# This consumes only local marker mtimes; it never reads DSNs, archive data,
# provider credentials, or Restic repository contents.
set -euo pipefail

REPO_ROOT="$(pwd -P)"
BACKUP_DIR_INPUT="${ASTROLOGY_BACKUP_DIR:-$REPO_ROOT/.backups/postgres}"

if [[ ! -d "$BACKUP_DIR_INPUT" ]]; then
  echo "Backup directory does not exist" >&2
  exit 1
fi
BACKUP_DIR="$(realpath -e -- "$BACKUP_DIR_INPUT")"
if [[ "$BACKUP_DIR" == "/" || "$BACKUP_DIR" == "$REPO_ROOT" ]]; then
  echo "Refusing unsafe backup directory" >&2
  exit 1
fi

max_age_seconds() {
  local name="$1"
  local value="$2"
  local multiplier="$3"
  if [[ ! "$value" =~ ^[1-9][0-9]{0,4}$ ]]; then
    echo "$name must be a positive integer" >&2
    exit 1
  fi
  printf '%s' "$((value * multiplier))"
}

check_marker() {
  local label="$1"
  local filename="$2"
  local max_age="$3"
  local path="$BACKUP_DIR/$filename"
  if [[ ! -f "$path" ]]; then
    echo "$label has never completed" >&2
    return 1
  fi
  local age="$(( $(date -u +%s) - $(stat -c %Y -- "$path") ))"
  if (( age < 0 || age > max_age )); then
    echo "$label is stale (age ${age}s, limit ${max_age}s)" >&2
    return 1
  fi
}

local_backup_max="$(max_age_seconds ASTROLOGY_BACKUP_MAX_AGE_HOURS "${ASTROLOGY_BACKUP_MAX_AGE_HOURS:-30}" 3600)"
offsite_backup_max="$(max_age_seconds ASTROLOGY_OFFSITE_BACKUP_MAX_AGE_HOURS "${ASTROLOGY_OFFSITE_BACKUP_MAX_AGE_HOURS:-30}" 3600)"
local_restore_max="$(max_age_seconds ASTROLOGY_RESTORE_DRILL_MAX_AGE_DAYS "${ASTROLOGY_RESTORE_DRILL_MAX_AGE_DAYS:-40}" 86400)"
offsite_restore_max="$(max_age_seconds ASTROLOGY_OFFSITE_RESTORE_DRILL_MAX_AGE_DAYS "${ASTROLOGY_OFFSITE_RESTORE_DRILL_MAX_AGE_DAYS:-40}" 86400)"

check_marker "Local database backup" .backup-last-success "$local_backup_max"
check_marker "Off-site database backup" .offsite-backup-last-success "$offsite_backup_max"
check_marker "Local database restore drill" .restore-drill-last-success "$local_restore_max"
check_marker "Off-site database restore drill" .offsite-restore-drill-last-success "$offsite_restore_max"

echo "Database backup health markers are current"
