#!/usr/bin/env bash
# Read-only preflight for the astrology app's host PostgreSQL connection.
# Never prints ASTROLOGY_DATABASE_URL or reads the host .env file.
set -euo pipefail

WEB_CONTAINER="${ASTROLOGY_WEB_CONTAINER:-fernandofamily-astrology-web-1}"
DOCKER_NETWORK="${ASTROLOGY_DOCKER_NETWORK:-fernandofamily-astrology_default}"
DATABASE="astrology"
ROLE="astrology_app"
failures=0

pass() { printf 'PASS %s\n' "$1"; }
fail() {
  printf 'FAIL %s\n' "$1" >&2
  failures=$((failures + 1))
}

for command in docker sudo grep ss awk python3; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$command" >&2
    exit 2
  fi
done

if [[ "$(docker inspect --format '{{.State.Running}}' "$WEB_CONTAINER" 2>/dev/null || true)" != "true" ]]; then
  fail "web container is not running"
  exit 1
fi
pass "web container is running"

network_info="$(docker network inspect "$DOCKER_NETWORK" --format '{{range .IPAM.Config}}{{.Subnet}}|{{.Gateway}}{{end}}' 2>/dev/null || true)"
network_subnet="${network_info%%|*}"
network_gateway="${network_info#*|}"
if [[ ! "$network_subnet" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/[0-9]+$ || ! "$network_gateway" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  fail "Compose network subnet/gateway could not be read"
  exit 1
fi
network_address_and_mask="$(python3 -c 'import ipaddress,sys; network=ipaddress.ip_network(sys.argv[1], strict=True); print(f"{network.network_address}|{network.netmask}")' "$network_subnet")"
network_address="${network_address_and_mask%%|*}"
network_netmask="${network_address_and_mask#*|}"
pass "Compose network is present ($network_subnet)"

host_gateway="$(docker exec "$WEB_CONTAINER" node -e 'require("node:dns").lookup("host.docker.internal", (error, value) => { if (error) process.exit(1); process.stdout.write(value); })' 2>/dev/null || true)"
if [[ ! "$host_gateway" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  fail "host.docker.internal did not resolve to an IPv4 address in the web container"
  exit 1
fi
pass "web container resolves the host PostgreSQL address"

pg_facts="$(sudo -n -u postgres psql -XAtq -d "$DATABASE" -c "
SELECT current_setting('listen_addresses');
SELECT EXISTS (
  SELECT 1 FROM pg_authid
  WHERE rolname = '$ROLE' AND rolcanlogin AND rolpassword LIKE 'SCRAM-SHA-256%'
    AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls
);
SELECT has_database_privilege('$ROLE', '$DATABASE', 'CONNECT');
SELECT has_schema_privilege('$ROLE', 'public', 'USAGE');
SELECT bool_and(has_table_privilege('$ROLE', 'public.' || table_name, 'SELECT,INSERT,UPDATE,DELETE'))
  FROM unnest(ARRAY['profiles','preferences','push_subscriptions','push_sent']) AS table_name;
SELECT count(*) = 4 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='push_subscriptions'
    AND column_name IN ('quiet_start_hour','quiet_end_hour','allowed_weekdays','max_alerts_per_day');
SELECT count(*) = 3 FROM pg_constraint
  WHERE conrelid='public.push_subscriptions'::regclass
    AND conname IN ('push_quiet_hours_valid','push_allowed_weekdays_valid','push_max_alerts_per_day_valid');
SELECT count(*) = 1 FROM pg_hba_file_rules
  WHERE type='host' AND database @> ARRAY['$DATABASE']::text[]
    AND user_name @> ARRAY['$ROLE']::text[] AND address = '$network_address'
    AND netmask = '$network_netmask'
    AND auth_method='scram-sha-256' AND error IS NULL;
SELECT count(*) = 0 FROM pg_hba_file_rules
  WHERE type IN ('host','hostssl','hostnossl') AND error IS NULL
    AND coalesce(address,'') NOT IN ('127.0.0.1','::1')
    AND NOT (type='host' AND database @> ARRAY['$DATABASE']::text[]
      AND user_name @> ARRAY['$ROLE']::text[] AND address = '$network_address'
      AND netmask = '$network_netmask' AND auth_method='scram-sha-256');
" 2>/dev/null)" || {
  fail "local PostgreSQL verification queries failed"
  exit 1
}
mapfile -t pg_facts <<<"$pg_facts"
if (( ${#pg_facts[@]} != 9 )); then
  fail "PostgreSQL returned an unexpected verification result"
  exit 1
fi
listen_addresses="${pg_facts[0]}"
case ",$listen_addresses," in
  *,"$host_gateway",*) pass "PostgreSQL is configured for loopback plus the Docker host gateway" ;;
  *) fail "PostgreSQL listen_addresses omits the Docker host gateway" ;;
esac
case ",$listen_addresses," in
  *,localhost,*|*,127.0.0.1,*) pass "PostgreSQL retains loopback access" ;;
  *) fail "PostgreSQL loopback access is missing" ;;
esac
case ",$listen_addresses," in
  *,"*",*|*,"0.0.0.0",*|*,"::",*) fail "PostgreSQL listen_addresses includes a wildcard interface" ;;
  *) pass "PostgreSQL is not configured to listen on all interfaces" ;;
esac
if [[ "${pg_facts[1]}" == "t" ]]; then pass "app login exists with SCRAM authentication and no elevated role flags"; else fail "app login is missing or has elevated flags/weak authentication"; fi
if [[ "${pg_facts[2]}" == "t" ]]; then pass "app role can connect to the astrology database"; else fail "app role lacks database CONNECT"; fi
if [[ "${pg_facts[3]}" == "t" ]]; then pass "app role has schema USAGE"; else fail "app role lacks schema USAGE"; fi
if [[ "${pg_facts[4]}" == "t" ]]; then pass "app role has CRUD access to the four required tables"; else fail "app table grants are incomplete"; fi
if [[ "${pg_facts[5]}" == "t" && "${pg_facts[6]}" == "t" ]]; then pass "quiet-hours and alert-rule migrations are present"; else fail "push preference migrations are incomplete"; fi
if [[ "${pg_facts[7]}" == "t" ]]; then pass "pg_hba has one matching database/role/subnet SCRAM rule"; else fail "the scoped pg_hba rule is missing or invalid"; fi
if [[ "${pg_facts[8]}" == "t" ]]; then pass "pg_hba has no other non-loopback client rules"; else fail "a broader non-loopback pg_hba rule is present"; fi

firewall="$(sudo -n ufw status 2>/dev/null || true)"
port_rules="$(grep -F '5432/tcp' <<<"$firewall" || true)"
scoped_rule_found=0
unsafe_rule_found=0
while IFS= read -r rule; do
  [[ -z "$rule" ]] && continue
  if [[ "$rule" == *"$host_gateway 5432/tcp"* && "$rule" == *"$network_subnet"* ]]; then
    scoped_rule_found=1
  else
    unsafe_rule_found=1
  fi
done <<<"$port_rules"
if (( scoped_rule_found == 1 && unsafe_rule_found == 0 )); then
  pass "UFW PostgreSQL rules target only the Compose subnet and host gateway"
else
  fail "UFW PostgreSQL rules are missing or broader than the Compose subnet"
fi

if sudo -n ss -ltnH '( sport = :5432 )' | awk -v target="$host_gateway:5432" '$4 == target { found=1 } END { exit !found }'; then
  pass "PostgreSQL is listening on the expected Docker host address"
else
  fail "PostgreSQL is not listening on the expected Docker host address"
fi

if docker exec "$WEB_CONTAINER" node -e '
const u = new URL(process.env.ASTROLOGY_DATABASE_URL || "");
if (u.hostname !== "host.docker.internal" || decodeURIComponent(u.username) !== "astrology_app" || decodeURIComponent(u.pathname.slice(1)) !== "astrology") process.exit(2);
const { Client } = require("pg");
(async () => {
  const client = new Client({ connectionString: u.toString(), connectionTimeoutMillis: 5000 });
  await client.connect();
  const result = await client.query("SELECT current_database() AS db, current_user AS role");
  await client.end();
  if (result.rows[0].db !== "astrology" || result.rows[0].role !== "astrology_app") process.exit(3);
})().catch(() => process.exit(1));
' >/dev/null 2>&1; then
  pass "web container connects as the configured app role to the astrology database"
else
  fail "web-container PostgreSQL connection probe failed (details suppressed)"
fi

if (( failures > 0 )); then
  printf 'Preflight failed: %d check(s) need attention. No changes were made.\n' "$failures" >&2
  exit 1
fi
printf 'Preflight passed. This check is read-only; no changes were made.\n'
