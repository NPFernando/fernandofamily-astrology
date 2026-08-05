#!/usr/bin/env bash
# Hermetic checks for the backup/drill safety boundaries. PostgreSQL clients
# are stubbed so CI never needs a database or a production-like credential.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd -P)"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf -- "$WORK_DIR"' EXIT
FAKE_BIN="$WORK_DIR/bin"
BACKUP_DIR="$WORK_DIR/backups"
STATE_FILE="$WORK_DIR/restore-state"
RESTIC_STATE_FILE="$WORK_DIR/restic-state"
ALERT_STATE_FILE="$WORK_DIR/alert-state"
mkdir -p "$FAKE_BIN"

cat > "$FAKE_BIN/pg_dump" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
for argument in "$@"; do
  case "$argument" in
    --file=*) printf 'fake-postgres-archive' > "${argument#--file=}" ;;
  esac
done
EOF

cat > "$FAKE_BIN/pg_restore" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [[ " $* " == *" --list "* ]]; then
  exit 0
fi
printf 'restore\n' >> "$TEST_RESTORE_STATE"
EOF

cat > "$FAKE_BIN/psql" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
arguments="$*"
if [[ "$arguments" == *"current_database"* ]]; then
  if [[ "$arguments" == *"/production"* ]]; then
    printf 'astrology\n'
  else
    printf 'astrology_restore_drill\n'
  fi
else
  printf '4\n'
fi
EOF

cat > "$FAKE_BIN/restic" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$1" >> "$TEST_RESTIC_STATE"
if [[ "$1" == "restore" ]]; then
  target=""
  for ((index = 1; index <= $#; index += 1)); do
    if [[ "${!index}" == "--target" ]]; then
      next=$((index + 1))
      target="${!next}"
      break
    fi
  done
  [[ -n "$target" ]]
  mkdir -p "$target/archive"
  printf 'fake-offsite-postgres-archive' > "$target/archive/astrology-offsite.dump"
fi
EOF

cat > "$FAKE_BIN/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" > "$TEST_ALERT_STATE"
EOF

chmod 700 "$FAKE_BIN/pg_dump" "$FAKE_BIN/pg_restore" "$FAKE_BIN/psql" "$FAKE_BIN/restic" "$FAKE_BIN/curl"

export PATH="$FAKE_BIN:$PATH"
export ASTROLOGY_DATABASE_URL="postgresql://example/production"
export RESTORE_DRILL_DATABASE_URL="postgresql://example/drill"
export ASTROLOGY_BACKUP_DIR="$BACKUP_DIR"
export ASTROLOGY_BACKUP_RETENTION_DAYS=14
export TEST_RESTORE_STATE="$STATE_FILE"
export TEST_RESTIC_STATE="$RESTIC_STATE_FILE"
export TEST_ALERT_STATE="$ALERT_STATE_FILE"
export RESTIC_REPOSITORY="s3:https://object.example.invalid/fernandofamily-astrology"
export RESTIC_PASSWORD_FILE="$WORK_DIR/restic-password"
printf 'test-restic-password' > "$RESTIC_PASSWORD_FILE"
chmod 600 "$RESTIC_PASSWORD_FILE"

bash "$REPO_ROOT/infra/deploy/database-backup.sh"
backup="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'astrology-*.dump' -print -quit)"
[[ -n "$backup" && -s "$backup" ]]
[[ "$(stat -c '%a' "$backup")" == "600" ]]

bash "$REPO_ROOT/infra/deploy/database-restore-drill.sh" "$backup"
[[ "$(cat "$STATE_FILE")" == "restore" ]]

bash "$REPO_ROOT/infra/deploy/database-offsite-backup.sh"
grep -Fxq backup "$RESTIC_STATE_FILE"
grep -Fxq forget "$RESTIC_STATE_FILE"
grep -Fxq check "$RESTIC_STATE_FILE"

bash "$REPO_ROOT/infra/deploy/database-offsite-restore-drill.sh"
[[ "$(grep -Fc restore "$STATE_FILE")" == "2" ]]
grep -Fxq restore "$RESTIC_STATE_FILE"

bash "$REPO_ROOT/infra/deploy/database-backup-healthcheck.sh"

export ALERT_WEBHOOK_URL_FILE="$WORK_DIR/alert-webhook-url"
printf 'https://alerts.example.invalid/operations' > "$ALERT_WEBHOOK_URL_FILE"
chmod 600 "$ALERT_WEBHOOK_URL_FILE"
bash "$REPO_ROOT/infra/deploy/database-backup-alert.sh" fernandofamily-db-backup-healthcheck.service
grep -Fq 'DatabaseBackupFreshnessFailed' "$ALERT_STATE_FILE"

if RESTORE_DRILL_DATABASE_URL="$ASTROLOGY_DATABASE_URL" bash "$REPO_ROOT/infra/deploy/database-restore-drill.sh" "$backup"; then
  echo "restore drill accepted the production database" >&2
  exit 1
fi

echo "database backup and restore-drill safety checks passed"
