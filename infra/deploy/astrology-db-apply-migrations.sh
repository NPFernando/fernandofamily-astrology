#!/usr/bin/env bash
# Explicit, transactional application of the reviewed astrology DB migrations.
# This helper is never called by container startup or the normal app deploy.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
MIGRATIONS=(
  "$REPO_ROOT/apps/web/db/migrations/003_push_quiet_hours.sql"
  "$REPO_ROOT/apps/web/db/migrations/004_push_alert_rules.sql"
)

if [[ "${1:-}" != "--apply" ]]; then
  printf 'Plan only; no SQL executed. Reviewed migrations:\n'
  for migration in "${MIGRATIONS[@]}"; do
    [[ -f "$migration" ]] || { printf 'Missing migration: %s\n' "$(basename -- "$migration")" >&2; exit 1; }
    sha256sum -- "$migration"
  done
  printf 'To apply, use --apply --confirm astrology --backup-verified after checking the runbook.\n'
  exit 0
fi

if [[ "${2:-}" != "--confirm" || "${3:-}" != "astrology" || "${4:-}" != "--backup-verified" || $# -ne 4 ]]; then
  printf 'Refusing DDL: require --apply --confirm astrology --backup-verified.\n' >&2
  exit 2
fi

for migration in "${MIGRATIONS[@]}"; do
  [[ -f "$migration" ]] || { printf 'Missing migration: %s\n' "$(basename -- "$migration")" >&2; exit 1; }
done

if ! command -v sudo >/dev/null 2>&1 || ! command -v psql >/dev/null 2>&1; then
  printf 'Required commands sudo and psql must be installed.\n' >&2
  exit 2
fi

database="$(sudo -n -u postgres psql -XAtqc 'SELECT current_database()' astrology)"
if [[ "$database" != "astrology" ]]; then
  printf 'Refusing DDL: PostgreSQL did not connect to the expected database.\n' >&2
  exit 1
fi

printf 'Applying reviewed migrations in one transaction to database astrology:\n'
for migration in "${MIGRATIONS[@]}"; do
  printf '  %s\n' "$(basename -- "$migration")"
done
sudo -n -u postgres psql -X -v ON_ERROR_STOP=1 --single-transaction -d astrology \
  -f "${MIGRATIONS[0]}" -f "${MIGRATIONS[1]}" >/dev/null

verified="$(sudo -n -u postgres psql -XAtqc "
SELECT
  (SELECT count(*) = 4 FROM information_schema.columns
   WHERE table_schema='public' AND table_name='push_subscriptions'
     AND column_name IN ('quiet_start_hour','quiet_end_hour','allowed_weekdays','max_alerts_per_day'))
  AND
  (SELECT count(*) = 3 FROM pg_constraint
   WHERE conrelid='public.push_subscriptions'::regclass
     AND conname IN ('push_quiet_hours_valid','push_allowed_weekdays_valid','push_max_alerts_per_day_valid'));
" astrology)"
if [[ "$verified" != "t" ]]; then
  printf 'Migration verification failed; inspect PostgreSQL before retrying.\n' >&2
  exit 1
fi
printf 'Migrations applied and schema verification passed.\n'
