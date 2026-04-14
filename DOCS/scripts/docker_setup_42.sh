#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${USER:-}" ]]; then
  echo "USER is not set." >&2
  exit 1
fi

DATA_ROOT="/goinfre/${USER}/docker-root"
DOCKER_CONFIG_DIR="${HOME}/.config/docker"
DAEMON_JSON="${DOCKER_CONFIG_DIR}/daemon.json"
BACKUP_SUFFIX="$(date +%Y%m%d-%H%M%S)"

mkdir -p "${DATA_ROOT}"
mkdir -p "${DOCKER_CONFIG_DIR}" || true

if [[ -f "${DAEMON_JSON}" ]]; then
  cp "${DAEMON_JSON}" "${DAEMON_JSON}.${BACKUP_SUFFIX}.bak"
fi

cat > "${DAEMON_JSON}" <<EOF
{
  "data-root": "${DATA_ROOT}"
}
EOF

systemctl --user restart docker

echo ""
echo "Configured rootless Docker data-root:"
echo "  ${DATA_ROOT}"
echo ""
echo "Current Docker Root Dir:"
docker info | grep -i "Docker Root Dir"

