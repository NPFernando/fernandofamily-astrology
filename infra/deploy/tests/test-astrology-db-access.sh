#!/usr/bin/env bash
# Exercise the safe plan/confirmation gates without touching PostgreSQL.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd -P)"
MIGRATION_HELPER="$REPO_ROOT/infra/deploy/astrology-db-apply-migrations.sh"
ROLE_HELPER="$REPO_ROOT/infra/deploy/astrology-db-ensure-role.sh"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf -- "$WORK_DIR"' EXIT
FAKE_BIN="$WORK_DIR/bin"
mkdir -p "$FAKE_BIN"

for script in \
  "$REPO_ROOT/infra/deploy/astrology-db-preflight.sh" \
  "$MIGRATION_HELPER" \
  "$ROLE_HELPER"; do
  bash -n "$script"
done

plan="$("$MIGRATION_HELPER")"
grep -Fq 'Plan only; no SQL executed.' <<<"$plan"
grep -Fq '003_push_quiet_hours.sql' <<<"$plan"
grep -Fq '004_push_alert_rules.sql' <<<"$plan"

set +e
"$MIGRATION_HELPER" --apply --confirm astrology >/dev/null 2>&1
migration_status=$?
"$ROLE_HELPER" >/dev/null 2>&1
role_status=$?
set -e

[[ "$migration_status" -eq 2 ]]
[[ "$role_status" -eq 2 ]]

cat > "$FAKE_BIN/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == "inspect" ]]; then
  printf 'true'
  exit 0
fi
[[ "${1:-}" == "exec" ]] || exit 2
shift
[[ "${1:-}" == "-i" ]] && shift
shift # container name
ASTROLOGY_DATABASE_URL='postgresql://astrology_app:test-placeholder@host.docker.internal:5432/astrology' "$@"
EOF

cat > "$FAKE_BIN/sudo" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
arguments="$*"
if [[ "$arguments" == *"SELECT current_database()"* ]]; then
  printf 'astrology\n'
elif [[ "$arguments" == *"information_schema.columns"* ]]; then
  printf 't\n'
elif [[ "$arguments" == *"--single-transaction"* ]]; then
  [[ "$arguments" == *"003_push_quiet_hours.sql"* && "$arguments" == *"004_push_alert_rules.sql"* ]]
  printf 'transactional migration invocation verified\n' >> "$TEST_MIGRATION_CAPTURE"
else
  printf '%s' > "$TEST_ROLE_CAPTURE"
  cat > "$TEST_ROLE_CAPTURE"
fi
EOF
chmod 700 "$FAKE_BIN/docker" "$FAKE_BIN/sudo"

export PATH="$FAKE_BIN:$PATH"
export TEST_MIGRATION_CAPTURE="$WORK_DIR/migration-invocation"
export TEST_ROLE_CAPTURE="$WORK_DIR/role-sql"

role_output="$("$ROLE_HELPER" --apply --confirm astrology_app@astrology)"
grep -Fq 'secret not displayed' <<<"$role_output"
grep -Fq "ALTER ROLE astrology_app LOGIN PASSWORD 'test-placeholder'" "$TEST_ROLE_CAPTURE"
grep -Fq 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles' "$TEST_ROLE_CAPTURE"
if grep -Fq 'test-placeholder' <<<"$role_output"; then
  echo 'role helper exposed the fixture password' >&2
  exit 1
fi

"$MIGRATION_HELPER" --apply --confirm astrology --backup-verified >/dev/null
grep -Fq 'transactional migration invocation verified' "$TEST_MIGRATION_CAPTURE"
grep -Fq 'preflight' "$REPO_ROOT/docs/deployment/astrology-database-access.md"
grep -Fq 'Rollback' "$REPO_ROOT/docs/deployment/astrology-database-access.md"

echo "astrology database access plan and confirmation gates passed"
