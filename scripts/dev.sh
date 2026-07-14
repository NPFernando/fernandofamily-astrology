#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"
API_URL="http://127.0.0.1:${API_PORT}"

if [[ ! -x "${ROOT_DIR}/apps/api/.venv/bin/uvicorn" ]]; then
  echo "Missing apps/api/.venv. Run: make setup" >&2
  exit 1
fi

if [[ ! -d "${ROOT_DIR}/apps/web/node_modules" ]]; then
  echo "Missing apps/web/node_modules. Run: make setup" >&2
  exit 1
fi

pids=()
cleanup() {
  for pid in "${pids[@]}"; do
    if kill -0 "${pid}" 2>/dev/null; then
      kill "${pid}" 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT INT TERM

(
  cd "${ROOT_DIR}/apps/api"
  .venv/bin/uvicorn app.main:app --reload --port "${API_PORT}"
) &
pids+=("$!")

(
  cd "${ROOT_DIR}/apps/web"
  API_PROXY_TARGET="${API_URL}" pnpm exec next dev --port "${WEB_PORT}"
) &
pids+=("$!")

echo "API: ${API_URL}"
echo "Web: http://127.0.0.1:${WEB_PORT}"

wait -n "${pids[@]}"
