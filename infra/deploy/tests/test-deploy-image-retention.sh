#!/usr/bin/env bash
# Hermetic check that a successful deploy prunes stale per-commit-SHA
# release images while keeping the ones still reachable via rollback (the
# tag just deployed, and whatever .last-good-tag names) — docker and curl
# are stubbed so CI never needs a real registry, compose stack, or host.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd -P)"
DEPLOY_SCRIPT="$REPO_ROOT/infra/deploy/deploy.sh"
bash -n "$DEPLOY_SCRIPT"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf -- "$WORK_DIR"' EXIT
FAKE_BIN="$WORK_DIR/bin"
mkdir -p "$FAKE_BIN"
RMI_LOG="$WORK_DIR/rmi-calls.log"
: > "$RMI_LOG"

cat > "$FAKE_BIN/docker" <<EOF
#!/usr/bin/env bash
set -euo pipefail
if [ "\${1:-}" = "compose" ]; then
  exit 0
fi
if [ "\${1:-}" = "image" ] && [ "\${2:-}" = "ls" ]; then
  shift 2
  repo=""
  while [ "\$#" -gt 0 ]; do
    case "\$1" in
      --format) shift 2 ;;
      *) repo="\$1"; shift ;;
    esac
  done
  case "\$repo" in
    */fernandofamily-astrology-api)
      printf '%s\n' "old-sha-aaa" "old-sha-bbb" "new-good-sha" "prev-good-sha" ;;
    */fernandofamily-astrology-web)
      printf '%s\n' "old-sha-ccc" "new-good-sha" "prev-good-sha" ;;
  esac
  exit 0
fi
if [ "\${1:-}" = "rmi" ]; then
  shift
  printf '%s\n' "\$@" >> "$RMI_LOG"
  exit 0
fi
exit 0
EOF
chmod +x "$FAKE_BIN/docker"

cat > "$FAKE_BIN/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
url="${*: -1}"
case "$url" in
  */api/v1/health/ready) exit 0 ;;
  */en) printf '<html></html>' ;;
  */manifest.webmanifest) printf '{"name":"x"}' ;;
  */sw.js) printf 'CACHE_NAME' ;;
  */en/roadmap) printf '<html></html>' ;;
  */api/v1/metadata)
    printf '{"deployed_commit":"%s","features":[{"id":"porondam"},{"id":"dasha"}]}' "$IMAGE_TAG" ;;
  *) exit 1 ;;
esac
EOF
chmod +x "$FAKE_BIN/curl"

cd "$WORK_DIR"
echo "prev-good-sha" > .last-good-tag

PATH="$FAKE_BIN:$PATH" "$DEPLOY_SCRIPT" new-good-sha

grep -Fq 'new-good-sha' .last-good-tag

# Kept: the tag just deployed (new-good-sha) and the previous rollback
# target (prev-good-sha) — for both images.
if grep -Eq 'fernandofamily-astrology-(api|web):new-good-sha' "$RMI_LOG"; then
  echo "FAIL: rmi targeted the just-deployed tag" >&2
  exit 1
fi
if grep -Eq 'fernandofamily-astrology-(api|web):prev-good-sha' "$RMI_LOG"; then
  echo "FAIL: rmi targeted the rollback (last-good) tag" >&2
  exit 1
fi

# Pruned: everything else.
grep -Fq 'fernandofamily-astrology-api:old-sha-aaa' "$RMI_LOG"
grep -Fq 'fernandofamily-astrology-api:old-sha-bbb' "$RMI_LOG"
grep -Fq 'fernandofamily-astrology-web:old-sha-ccc' "$RMI_LOG"

echo "OK: deploy prunes stale release images while keeping rollback-reachable ones."
