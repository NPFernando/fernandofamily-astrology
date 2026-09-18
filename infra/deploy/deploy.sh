#!/usr/bin/env bash
# Runs ON the production host, invoked over SSH by .github/workflows/deploy.yml.
# Usage: deploy.sh <image-tag>
# Expects to be run from the repo checkout's root (where docker-compose.yml,
# docker-compose.production.yml, and .env already exist), with docker + the
# compose plugin available and the host already logged in to ghcr.io.
set -euo pipefail

IMAGE_TAG="${1:?usage: deploy.sh <image-tag>}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.production.yml)
LAST_GOOD_FILE=".last-good-tag"
API_IMAGE="${API_IMAGE:-ghcr.io/npfernando/fernandofamily-astrology-api}"
WEB_IMAGE="${WEB_IMAGE:-ghcr.io/npfernando/fernandofamily-astrology-web}"
# Captured before anything below can overwrite LAST_GOOD_FILE — this is the
# rollback target a *subsequent* failed deploy would fall back to, so it
# must never be pruned even after this deploy's own tag becomes the new
# last-good.
PREVIOUS_LAST_GOOD_TAG=""
if [ -f "$LAST_GOOD_FILE" ]; then
  PREVIOUS_LAST_GOOD_TAG="$(cat "$LAST_GOOD_FILE")"
fi
READY_URL="http://127.0.0.1:8100/api/v1/health/ready"
WEB_URL="http://127.0.0.1:3100"
METADATA_URL="http://127.0.0.1:8100/api/v1/metadata"
MAX_WAIT_SECONDS=60

if [ "${MONITORING_ENABLED:-0}" = "1" ]; then
  COMPOSE+=(--profile monitoring)
fi

smoke_check() {
  local metadata

  if ! curl -fsS --max-time 5 "$WEB_URL/en" | grep -Fq "<html"; then
    echo "Release smoke check failed: web app shell is unavailable at $WEB_URL/en" >&2
    return 1
  fi
  if ! curl -fsS --max-time 5 "$WEB_URL/manifest.webmanifest" | grep -Fq '"name"'; then
    echo "Release smoke check failed: PWA manifest is unavailable" >&2
    return 1
  fi
  if ! curl -fsS --max-time 5 "$WEB_URL/sw.js" | grep -Fq "CACHE_NAME"; then
    echo "Release smoke check failed: service worker is unavailable" >&2
    return 1
  fi
  if ! curl -fsS --max-time 5 "$WEB_URL/en/roadmap" | grep -Fq "<html"; then
    echo "Release smoke check failed: roadmap route is unavailable" >&2
    return 1
  fi
  if ! metadata="$(curl -fsS --max-time 5 "$METADATA_URL")"; then
    echo "Release smoke check failed: API metadata endpoint is unavailable" >&2
    return 1
  fi
  if ! printf '%s' "$metadata" | grep -Fq "\"deployed_commit\":\"$IMAGE_TAG\""; then
    echo "Release smoke check failed: API metadata does not report image tag $IMAGE_TAG" >&2
    return 1
  fi
  # These are the oldest and newest entries in the current public registry;
  # checking both catches a stale image that reports a valid commit but still
  # exposes only the earlier three-feature metadata projection.
  for feature_id in '"id":"porondam"' '"id":"dasha"'; do
    if ! printf '%s' "$metadata" | grep -Fq "$feature_id"; then
      echo "Release smoke check failed: public feature registry is incomplete ($feature_id)" >&2
      return 1
    fi
  done
}

# Every deploy pulls a new per-commit-SHA tag and nothing ever removed the
# old ones — deploy.sh only ever *reads* LAST_GOOD_FILE for rollback, never
# prunes. Left unattended this silently grew to 70+ old tags per image on
# the host (dozens of GB of stale layers). This keeps exactly the images
# still reachable via rollback (the tag just deployed, plus whatever
# LAST_GOOD_FILE names) and removes the rest. Best-effort and non-fatal —
# a prune failure (e.g. an image still referenced by a container mid
# transition) must never fail the deploy itself.
prune_stale_release_images() {
  local last_good="$PREVIOUS_LAST_GOOD_TAG"

  local repo tag stale
  for repo in "$API_IMAGE" "$WEB_IMAGE"; do
    stale=()
    while IFS= read -r tag; do
      [ -z "$tag" ] && continue
      if [ "$tag" = "$IMAGE_TAG" ]; then
        continue
      fi
      if [ -n "$last_good" ] && [ "$tag" = "$last_good" ]; then
        continue
      fi
      stale+=("${repo}:${tag}")
    done < <(docker image ls --format '{{.Tag}}' "$repo" 2>/dev/null)

    if [ "${#stale[@]}" -gt 0 ]; then
      echo "Pruning ${#stale[@]} stale $repo image(s): ${stale[*]}"
      docker rmi "${stale[@]}" >/dev/null 2>&1 ||
        echo "Warning: could not remove some stale $repo images (may still be referenced)." >&2
    fi
  done
}

wait_for_release() {
  local waited=0
  while [ "$waited" -lt "$MAX_WAIT_SECONDS" ]; do
    if curl -fsS --max-time 5 "$READY_URL" >/dev/null 2>&1 && smoke_check >/dev/null 2>&1; then
      return 0
    fi
    sleep 3
    waited=$((waited + 3))
  done

  if ! curl -fsS --max-time 5 "$READY_URL" >/dev/null 2>&1; then
    echo "Release check failed: API readiness is unavailable at $READY_URL" >&2
  else
    smoke_check || true
  fi
  return 1
}

echo "Deploying image tag: $IMAGE_TAG"
export IMAGE_TAG
"${COMPOSE[@]}" pull
"${COMPOSE[@]}" up -d --no-build

if wait_for_release; then
  echo "$IMAGE_TAG" > "$LAST_GOOD_FILE"
  echo "Deploy succeeded, readiness and release smoke checks passed. Recorded $IMAGE_TAG as last-good."
  prune_stale_release_images
  exit 0
fi

echo "Release check failed for $IMAGE_TAG after ${MAX_WAIT_SECONDS}s. Attempting rollback." >&2

if [ ! -f "$LAST_GOOD_FILE" ]; then
  echo "No previous known-good tag recorded — cannot roll back automatically. Manual intervention required." >&2
  exit 1
fi

PREVIOUS_TAG="$(cat "$LAST_GOOD_FILE")"
echo "Rolling back to previous known-good tag: $PREVIOUS_TAG" >&2
export IMAGE_TAG="$PREVIOUS_TAG"
"${COMPOSE[@]}" pull
"${COMPOSE[@]}" up -d --no-build

if wait_for_release; then
  echo "Rollback to $PREVIOUS_TAG succeeded." >&2
  exit 1
else
  echo "Rollback to $PREVIOUS_TAG ALSO failed readiness. Manual intervention required immediately." >&2
  exit 1
fi
