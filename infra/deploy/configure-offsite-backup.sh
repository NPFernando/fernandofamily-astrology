#!/usr/bin/env bash
# Create or update non-secret off-site backup settings. Provider credentials
# are never accepted as arguments and the Restic password is referenced by path.
set -euo pipefail
umask 077

usage() {
  cat <<'EOF'
usage: configure-offsite-backup.sh --provider PROVIDER --repository URL --password-file PATH [options]
Providers: s3, b2, r2, oci, custom
Options:
  --env-file PATH       Environment file (default: /etc/fernandofamily-astrology/database-backup.env)
  --retention-daily N   Daily snapshots (default: 14)
  --retention-weekly N  Weekly snapshots (default: 8)
  --retention-monthly N Monthly snapshots (default: 12)
  --replace              Replace existing off-site keys in the env file
  --help                 Show this help
EOF
}

provider=""; repository=""; password_file=""
env_file="/etc/fernandofamily-astrology/database-backup.env"
daily=14; weekly=8; monthly=12; replace=0
while (($#)); do
  case "$1" in
    --provider) [[ $# -ge 2 ]] || { echo "--provider requires a value" >&2; exit 2; }; provider="$2"; shift 2 ;;
    --repository) [[ $# -ge 2 ]] || { echo "--repository requires a value" >&2; exit 2; }; repository="$2"; shift 2 ;;
    --password-file) [[ $# -ge 2 ]] || { echo "--password-file requires a value" >&2; exit 2; }; password_file="$2"; shift 2 ;;
    --env-file) [[ $# -ge 2 ]] || { echo "--env-file requires a value" >&2; exit 2; }; env_file="$2"; shift 2 ;;
    --retention-daily) [[ $# -ge 2 ]] || { echo "--retention-daily requires a value" >&2; exit 2; }; daily="$2"; shift 2 ;;
    --retention-weekly) [[ $# -ge 2 ]] || { echo "--retention-weekly requires a value" >&2; exit 2; }; weekly="$2"; shift 2 ;;
    --retention-monthly) [[ $# -ge 2 ]] || { echo "--retention-monthly requires a value" >&2; exit 2; }; monthly="$2"; shift 2 ;;
    --replace) replace=1; shift ;;
    --help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ "$provider" =~ ^(s3|b2|r2|oci|custom)$ ]] || { echo "provider must be one of: s3, b2, r2, oci, custom" >&2; exit 2; }
[[ "$repository" =~ ^(s3|b2|rclone|sftp):[^[:space:]]+$ ]] || { echo "repository must use s3:, b2:, rclone:, or sftp:" >&2; exit 2; }
[[ "$repository" != *\?* && "$repository" != *#* && "$repository" != *'@'* ]] || { echo "repository must not contain query strings, fragments, or embedded credentials" >&2; exit 2; }
[[ "$password_file" = /* ]] || { echo "password-file must be an absolute path" >&2; exit 2; }
[[ -f "$password_file" && -r "$password_file" ]] || { echo "password-file must be an existing readable file" >&2; exit 1; }
[[ "$(stat -c '%a' -- "$password_file")" == "600" ]] || { echo "password-file must have mode 0600" >&2; exit 1; }
for value in "$daily" "$weekly" "$monthly"; do
  [[ "$value" =~ ^[1-9][0-9]*$ ]] || { echo "retention values must be positive integers" >&2; exit 2; }
done
[[ "$env_file" = /* ]] || { echo "env-file must be an absolute path" >&2; exit 2; }
if [[ "$env_file" == /etc/* && "$EUID" -ne 0 ]]; then echo "root is required for an /etc environment file" >&2; exit 1; fi
if [[ -e "$env_file" && "$replace" != "1" ]]; then echo "environment file exists; pass --replace to update off-site settings" >&2; exit 1; fi

parent_dir="$(dirname -- "$env_file")"; mkdir -p -- "$parent_dir"
tmp_file="$(mktemp "$parent_dir/.database-backup.env.XXXXXX")"
cleanup() { rm -f -- "$tmp_file"; }; trap cleanup EXIT
if [[ -f "$env_file" ]]; then
  awk '!/^(RESTIC_REPOSITORY|RESTIC_PASSWORD_FILE|RESTIC_DATABASE_BACKUP_TAG|RESTIC_KEEP_DAILY|RESTIC_KEEP_WEEKLY|RESTIC_KEEP_MONTHLY|ASTROLOGY_OFFSITE_IMMUTABILITY_CONFIRMED)=/' "$env_file" > "$tmp_file"
fi
cat >> "$tmp_file" <<EOF
RESTIC_REPOSITORY=$repository
RESTIC_PASSWORD_FILE=$password_file
RESTIC_DATABASE_BACKUP_TAG=fernandofamily-astrology-postgres
RESTIC_KEEP_DAILY=$daily
RESTIC_KEEP_WEEKLY=$weekly
RESTIC_KEEP_MONTHLY=$monthly
ASTROLOGY_OFFSITE_IMMUTABILITY_CONFIRMED=0
EOF
chmod 600 -- "$tmp_file"
if [[ -e "$env_file" ]]; then
  mode="$(stat -c '%a' -- "$env_file")"
  [[ "$mode" == "600" || "$mode" == "640" ]] || { echo "existing env-file must have mode 0600 or 0640" >&2; exit 1; }
fi
mv -- "$tmp_file" "$env_file"; trap - EXIT
echo "Off-site backup configuration written: $env_file"
echo "Provider: $provider"
echo "Retention: daily=$daily weekly=$weekly monthly=$monthly"
echo "Provider immutable retention remains unconfirmed; verify it and set ASTROLOGY_OFFSITE_IMMUTABILITY_CONFIRMED=1 before activation."
