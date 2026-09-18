#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd -P)"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf -- "$WORK_DIR"' EXIT
password_file="$WORK_DIR/restic-password"
env_file="$WORK_DIR/database-backup.env"
printf 'do-not-print-this-secret\n' > "$password_file"
chmod 600 "$password_file"

output="$(bash "$REPO_ROOT/infra/deploy/configure-offsite-backup.sh" \
  --provider s3 --repository 's3:https://objects.example.invalid/bucket/astrology' \
  --password-file "$password_file" --env-file "$env_file" \
  --retention-daily 10 --retention-weekly 4 --retention-monthly 6)"
grep -Fq 'Provider: s3' <<<"$output"
! grep -Fq 'do-not-print-this-secret' <<<"$output"
[[ "$(stat -c '%a' "$env_file")" == "600" ]]
grep -Fxq 'RESTIC_KEEP_DAILY=10' "$env_file"
grep -Fxq 'RESTIC_KEEP_WEEKLY=4' "$env_file"
grep -Fxq 'RESTIC_KEEP_MONTHLY=6' "$env_file"
grep -Fxq 'ASTROLOGY_OFFSITE_IMMUTABILITY_CONFIRMED=0' "$env_file"
grep -Fq "RESTIC_PASSWORD_FILE=$password_file" "$env_file"
! grep -Fq 'do-not-print-this-secret' "$env_file"

if bash "$REPO_ROOT/infra/deploy/configure-offsite-backup.sh" \
  --provider s3 --repository 's3:https://objects.example.invalid/bucket/astrology' \
  --password-file "$password_file" --env-file "$env_file" >/dev/null 2>&1; then
  echo 'existing env file was overwritten without --replace' >&2; exit 1
fi
if bash "$REPO_ROOT/infra/deploy/configure-offsite-backup.sh" \
  --provider s3 --repository 'file:///unsafe' --password-file "$password_file" \
  --env-file "$WORK_DIR/invalid.env" >/dev/null 2>&1; then
  echo 'unsafe repository was accepted' >&2; exit 1
fi
chmod 644 "$password_file"
if bash "$REPO_ROOT/infra/deploy/configure-offsite-backup.sh" \
  --provider s3 --repository 's3:https://objects.example.invalid/bucket/astrology' \
  --password-file "$password_file" --env-file "$WORK_DIR/mode.env" >/dev/null 2>&1; then
  echo 'weak password-file mode was accepted' >&2; exit 1
fi
echo 'off-site backup configuration checks passed'
