#!/bin/sh
set -e
cd /app
# Keep named volume auth_node_modules in sync when package.json / lockfile change
export CI=true
pnpm install
exec "$@"
