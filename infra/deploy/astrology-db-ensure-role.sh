#!/usr/bin/env bash
# Provision the least-privilege astrology DB login using the URL already
# injected into the running web container. Never prints or stores its secret.
set -euo pipefail

WEB_CONTAINER="${ASTROLOGY_WEB_CONTAINER:-fernandofamily-astrology-web-1}"

if [[ "${1:-}" != "--apply" || "${2:-}" != "--confirm" || "${3:-}" != "astrology_app@astrology" || $# -ne 3 ]]; then
  printf 'Refusing role changes: require --apply --confirm astrology_app@astrology.\n' >&2
  exit 2
fi
if ! command -v docker >/dev/null 2>&1 || ! command -v sudo >/dev/null 2>&1; then
  printf 'Required commands docker and sudo must be installed.\n' >&2
  exit 2
fi
if [[ "$(docker inspect --format '{{.State.Running}}' "$WEB_CONTAINER" 2>/dev/null || true)" != "true" ]]; then
  printf 'The configured web container must be running to obtain its DB credential.\n' >&2
  exit 1
fi

set -o pipefail
if ! docker exec -i "$WEB_CONTAINER" node -e '
const u = new URL(process.env.ASTROLOGY_DATABASE_URL || "");
const user = decodeURIComponent(u.username);
const database = decodeURIComponent(u.pathname.slice(1));
const password = decodeURIComponent(u.password);
if (u.hostname !== "host.docker.internal" || user !== "astrology_app" || database !== "astrology" || !password) process.exit(2);
const quote = String.fromCharCode(39);
const literal = value => quote + value.split(quote).join(quote + quote) + quote;
const sql = [
  "BEGIN;",
  "DO $role$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = " + literal(user) + ") THEN EXECUTE " + literal("CREATE ROLE astrology_app LOGIN") + "; END IF; END $role$;",
  "ALTER ROLE astrology_app LOGIN PASSWORD " + literal(password) + ";",
  "GRANT CONNECT ON DATABASE astrology TO astrology_app;",
  "GRANT USAGE ON SCHEMA public TO astrology_app;",
  "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles, public.preferences, public.push_subscriptions, public.push_sent TO astrology_app;",
  "COMMIT;"
].join(String.fromCharCode(10));
process.stdout.write(sql + String.fromCharCode(10));
' 2>/dev/null | sudo -n -u postgres psql -X -v ON_ERROR_STOP=1 -d astrology >/dev/null 2>&1; then
  printf 'Role setup failed (details suppressed to protect the configured secret).\n' >&2
  exit 1
fi
printf 'astrology_app role is provisioned with scoped database/table grants; secret not displayed.\n'
