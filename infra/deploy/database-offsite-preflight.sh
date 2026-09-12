#!/usr/bin/env bash
# Verify that an operator-configured Restic destination is ready without
# creating snapshots, pruning data, or changing provider retention.
set -euo pipefail
umask 077

verify_remote=0
case "${1:-}" in
  "") ;;
  --verify-remote) verify_remote=1 ;;
  *)
    echo "usage: database-offsite-preflight.sh [--verify-remote]" >&2
    exit 2
    ;;
esac

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY must be set}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE must be set}"
: "${ASTROLOGY_OFFSITE_IMMUTABILITY_CONFIRMED:?ASTROLOGY_OFFSITE_IMMUTABILITY_CONFIRMED must be set to 1 after provider retention is verified}"

if [[ "$ASTROLOGY_OFFSITE_IMMUTABILITY_CONFIRMED" != "1" ]]; then
  echo "Provider immutable-retention verification has not been confirmed" >&2
  exit 1
fi
if [[ ! -r "$RESTIC_PASSWORD_FILE" ]]; then
  echo "RESTIC_PASSWORD_FILE is not readable" >&2
  exit 1
fi
if [[ "$(stat -c '%a' "$RESTIC_PASSWORD_FILE")" != "600" ]]; then
  echo "RESTIC_PASSWORD_FILE must have mode 0600" >&2
  exit 1
fi
if ! command -v restic >/dev/null 2>&1; then
  echo "restic is required for off-site backup activation" >&2
  exit 1
fi

if [[ "$verify_remote" == "1" ]]; then
  # This read-only probe confirms that the configured credentials can reach
  # the existing repository. Suppress provider output to avoid leaking a URL
  # or credential-derived diagnostic into an operations log.
  if ! restic snapshots --tag "${RESTIC_DATABASE_BACKUP_TAG:-fernandofamily-astrology-postgres}" --no-lock >/dev/null 2>&1; then
    echo "Unable to read the configured off-site repository" >&2
    exit 1
  fi
fi

echo "Off-site backup preflight passed"
