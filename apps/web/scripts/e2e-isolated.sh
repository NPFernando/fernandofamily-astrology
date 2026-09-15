#!/usr/bin/env bash
set -Eeuo pipefail

# Run browser persistence tests against a disposable PostgreSQL instance. The
# repository .env is never used as a database source, and the app gets only a
# loopback URL for a least-privilege, E2E-only role/database.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="astrology-e2e-${USER:-runner}-$$"
DB_PASSWORD="$(openssl rand -hex 24)"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker run --rm -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD="$DB_PASSWORD" \
  -p 127.0.0.1::5432 postgres:16-alpine >/dev/null

DB_PORT=""
READY_COUNT=0
for _ in $(seq 1 60); do
  DB_PORT="$(docker port "$CONTAINER" 5432/tcp 2>/dev/null | sed -n 's/^127\.0\.0\.1:\([0-9][0-9]*\)$/\1/p' | head -n 1)"
  # pg_isready can briefly succeed against the image's temporary init server,
  # which is stopped before the final server starts. Require repeated real
  # queries to avoid racing that transition.
  if [[ -n "$DB_PORT" ]] && docker exec "$CONTAINER" psql -U postgres -d postgres -Atqc 'SELECT 1' >/dev/null 2>&1; then
    READY_COUNT=$((READY_COUNT + 1))
    if [[ "$READY_COUNT" -ge 3 ]]; then
      break
    fi
  else
    READY_COUNT=0
  fi
  sleep 1
done
if [[ -z "$DB_PORT" || "$READY_COUNT" -lt 3 ]]; then
  echo "Could not start disposable PostgreSQL on loopback" >&2
  exit 1
fi

docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -v e2e_password="$DB_PASSWORD" <<'SQL'
CREATE ROLE astrology_e2e_app LOGIN PASSWORD :'e2e_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE DATABASE astrology_e2e;
SQL

for migration in \
  "$ROOT_DIR/db/migrations/001_init.sql" \
  "$ROOT_DIR/db/migrations/002_push.sql" \
  "$ROOT_DIR/db/migrations/003_profile_moon_rashi.sql" \
  "$ROOT_DIR/db/migrations/003_push_quiet_hours.sql" \
  "$ROOT_DIR/db/migrations/004_push_alert_rules.sql"; do
  docker exec -i "$CONTAINER" psql -U postgres -d astrology_e2e -v ON_ERROR_STOP=1 < "$migration"
done

docker exec -i "$CONTAINER" psql -U postgres -d astrology_e2e -v ON_ERROR_STOP=1 <<'SQL'
GRANT CONNECT ON DATABASE astrology_e2e TO astrology_e2e_app;
GRANT USAGE ON SCHEMA public TO astrology_e2e_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles, preferences, push_subscriptions, push_sent TO astrology_e2e_app;
SQL

cd "$ROOT_DIR"
ASTROLOGY_DATABASE_URL="" API_PROXY_TARGET=http://127.0.0.1:8199 pnpm exec next build --webpack
node scripts/check-standalone-runtime.mjs
CI=1 ASTROLOGY_E2E_DATABASE_URL="postgresql://astrology_e2e_app:${DB_PASSWORD}@127.0.0.1:${DB_PORT}/astrology_e2e" \
  pnpm exec playwright test "$@"
