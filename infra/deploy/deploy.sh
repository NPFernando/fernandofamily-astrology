#!/usr/bin/env bash
# Runs ON the production host, invoked over SSH by .github/workflows/deploy.yml.
# Usage: deploy.sh <image-tag>
# Expects to be run from the repo checkout's root (where docker-compose.yml,
# docker-compose.production.yml, and .env already exist), with docker + the
# compose plugin available and the host already logged in to ghcr.io.
set -euo pipefail

IMAGE_TAG="${1:?usage: deploy.sh <image-tag>}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.production.yml"
LAST_GOOD_FILE=".last-good-tag"
READY_URL="http://127.0.0.1:8100/api/v1/health/ready"
MAX_WAIT_SECONDS=60

wait_for_ready() {
  local waited=0
  while [ "$waited" -lt "$MAX_WAIT_SECONDS" ]; do
    if curl -fsS "$READY_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 3
    waited=$((waited + 3))
  done
  return 1
}

echo "Deploying image tag: $IMAGE_TAG"
export IMAGE_TAG
$COMPOSE pull
$COMPOSE up -d --no-build

if wait_for_ready; then
  echo "$IMAGE_TAG" > "$LAST_GOOD_FILE"
  echo "Deploy succeeded, readiness check passed. Recorded $IMAGE_TAG as last-good."
  exit 0
fi

echo "Readiness check failed for $IMAGE_TAG after ${MAX_WAIT_SECONDS}s. Attempting rollback." >&2

if [ ! -f "$LAST_GOOD_FILE" ]; then
  echo "No previous known-good tag recorded — cannot roll back automatically. Manual intervention required." >&2
  exit 1
fi

PREVIOUS_TAG="$(cat "$LAST_GOOD_FILE")"
echo "Rolling back to previous known-good tag: $PREVIOUS_TAG" >&2
export IMAGE_TAG="$PREVIOUS_TAG"
$COMPOSE pull
$COMPOSE up -d --no-build

if wait_for_ready; then
  echo "Rollback to $PREVIOUS_TAG succeeded." >&2
  exit 1
else
  echo "Rollback to $PREVIOUS_TAG ALSO failed readiness. Manual intervention required immediately." >&2
  exit 1
fi
