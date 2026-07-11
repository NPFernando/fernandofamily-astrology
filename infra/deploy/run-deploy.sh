#!/usr/bin/env bash
# Forced-command target for the CI deploy SSH key (see ~/.ssh/authorized_keys
# on the production host and .github/workflows/deploy.yml). The deploy key
# can only ever run this script, nothing else — sshd sets
# SSH_ORIGINAL_COMMAND to whatever the client asked to run, which we treat
# as untrusted input and validate strictly before passing it on.
set -euo pipefail

IMAGE_TAG="${SSH_ORIGINAL_COMMAND:-}"

if [[ ! "$IMAGE_TAG" =~ ^[a-zA-Z0-9._-]{1,64}$ ]]; then
  echo "refused: invalid image tag '$IMAGE_TAG'" >&2
  exit 1
fi

cd /home/ubuntu/workspace/projects/fernandofamily-astrology
exec bash infra/deploy/deploy.sh "$IMAGE_TAG"
