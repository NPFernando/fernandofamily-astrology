#!/usr/bin/env bash
# Notify the restricted operations webhook that the backup health-check unit
# failed. The payload contains no credentials, paths, archive names, or data.
set -euo pipefail

: "${ALERT_WEBHOOK_URL_FILE:?ALERT_WEBHOOK_URL_FILE must be set}"
if [[ ! -r "$ALERT_WEBHOOK_URL_FILE" ]]; then
  echo "ALERT_WEBHOOK_URL_FILE is not readable" >&2
  exit 1
fi

url="$(<"$ALERT_WEBHOOK_URL_FILE")"
if [[ ! "$url" =~ ^https:// ]]; then
  echo "Backup alert webhook must use HTTPS" >&2
  exit 1
fi

unit="${1:-fernandofamily-db-backup-healthcheck.service}"
curl --fail --silent --show-error --max-time 15 \
  --request POST \
  --header 'Content-Type: application/json' \
  --data "{\"status\":\"firing\",\"alerts\":[{\"labels\":{\"alertname\":\"DatabaseBackupFreshnessFailed\",\"service\":\"fernandofamily-astrology\"},\"annotations\":{\"summary\":\"Database backup freshness check failed\",\"unit\":\"${unit}\"}}]}" \
  "$url"
