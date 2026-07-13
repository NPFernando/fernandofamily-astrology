#!/usr/bin/env bash
# Fires the push-notification dispatcher. Run from host cron every 5 minutes:
#   */5 * * * * /home/ubuntu/workspace/projects/fernandofamily-astrology/infra/deploy/push-dispatch.sh
# The dispatch endpoint lives in the web container (loopback :3100) and is
# unreachable from the public internet by construction — nginx routes public
# /api/* to the FastAPI container, which has no /api/internal/* paths.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_FILE="${REPO_DIR}/.push-dispatch.log"

KEY="$(grep '^INTERNAL_DISPATCH_KEY=' "${REPO_DIR}/.env" | cut -d= -f2-)"
if [ -z "$KEY" ]; then
  echo "$(date -Is) no INTERNAL_DISPATCH_KEY in .env, skipping" >> "$LOG_FILE"
  exit 0
fi

# Cap the log at ~200KB — this runs 288 times a day forever.
if [ -f "$LOG_FILE" ] && [ "$(stat -c%s "$LOG_FILE")" -gt 200000 ]; then
  tail -c 100000 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
fi

RESULT=$(curl -fsS -m 60 -X POST \
  -H "x-internal-key: ${KEY}" \
  http://127.0.0.1:3100/api/internal/push-dispatch 2>&1) \
  && echo "$(date -Is) ok ${RESULT:0:200}" >> "$LOG_FILE" \
  || echo "$(date -Is) FAIL ${RESULT:0:200}" >> "$LOG_FILE"
