#!/usr/bin/env bash
# Emit scrubbed, machine-readable evidence from local backup/drill markers.
# The report intentionally includes no file paths, archive names, database
# URLs, credentials, provider details, or repository URLs.
set -euo pipefail

if (( $# != 0 )); then
  echo "usage: database-recovery-evidence.sh" >&2
  exit 2
fi

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

NOW="$(date -u +%s)"
FAILED=0

report_marker() {
  local id="$1"
  local filename="$2"
  local maximum_age="$3"
  local marker="$BACKUP_DIR/$filename"

  if [[ ! -f "$marker" ]]; then
    FAILED=1
    printf '{"id":"%s","status":"missing","lastSucceededAt":null,"ageSeconds":null,"maximumAgeSeconds":%s}' "$id" "$maximum_age"
    return
  fi

  local marker_time age status
  marker_time="$(stat -c %Y -- "$marker")"
  age="$((NOW - marker_time))"
  status="current"
  if (( age < 0 || age > maximum_age )); then
    status="stale"
    FAILED=1
  fi
  printf '{"id":"%s","status":"%s","lastSucceededAt":"%s","ageSeconds":%s,"maximumAgeSeconds":%s}' \
    "$id" "$status" "$(date -u --date="@$marker_time" +%Y-%m-%dT%H:%M:%SZ)" "$age" "$maximum_age"
}

local_backup_max="$(max_age_seconds ASTROLOGY_BACKUP_MAX_AGE_HOURS "${ASTROLOGY_BACKUP_MAX_AGE_HOURS:-30}" 3600)"
offsite_backup_max="$(max_age_seconds ASTROLOGY_OFFSITE_BACKUP_MAX_AGE_HOURS "${ASTROLOGY_OFFSITE_BACKUP_MAX_AGE_HOURS:-30}" 3600)"
local_restore_max="$(max_age_seconds ASTROLOGY_RESTORE_DRILL_MAX_AGE_DAYS "${ASTROLOGY_RESTORE_DRILL_MAX_AGE_DAYS:-40}" 86400)"
offsite_restore_max="$(max_age_seconds ASTROLOGY_OFFSITE_RESTORE_DRILL_MAX_AGE_DAYS "${ASTROLOGY_OFFSITE_RESTORE_DRILL_MAX_AGE_DAYS:-40}" 86400)"

printf '{"format":"fernandofamily-recovery-evidence","generatedAt":"%s","checks":[' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
report_marker "local_backup" ".backup-last-success" "$local_backup_max"
printf ','
report_marker "offsite_backup" ".offsite-backup-last-success" "$offsite_backup_max"
printf ','
report_marker "local_restore_drill" ".restore-drill-last-success" "$local_restore_max"
printf ','
report_marker "offsite_restore_drill" ".offsite-restore-drill-last-success" "$offsite_restore_max"
printf ']}\n'

exit "$FAILED"
