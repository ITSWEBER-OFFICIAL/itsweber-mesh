#!/bin/sh
set -e

DATA_DIR="${DATA_DIR:-/data}"

# Ensure /data is writable and config.json will be bootstrapped by store.ts
mkdir -p "$DATA_DIR"

# Warn loudly if /data is not a mounted volume — config.json would be lost
# on the next container restart. We detect this by checking whether the
# directory is on the same filesystem as the rootfs (no separate mount).
if [ -z "${MESH_SKIP_VOLUME_CHECK:-}" ]; then
  data_dev=$(stat -c "%d" "$DATA_DIR" 2>/dev/null || echo "")
  root_dev=$(stat -c "%d" / 2>/dev/null || echo "")
  if [ -n "$data_dev" ] && [ -n "$root_dev" ] && [ "$data_dev" = "$root_dev" ]; then
    echo "============================================================"
    echo "WARNING: $DATA_DIR appears to be inside the container layer."
    echo "Mount a persistent volume (-v /host/path:$DATA_DIR), otherwise"
    echo "config.json and all admin changes will be LOST on restart."
    echo "Set MESH_SKIP_VOLUME_CHECK=1 to silence this warning."
    echo "============================================================"
  fi
fi

# Next.js standalone tries to resolve the system hostname on start.
# With --network=host the container inherits the Unraid host's hostname
# which is not DNS-resolvable inside the container. Force binding to 0.0.0.0.
export HOSTNAME=0.0.0.0

exec node apps/web/server.js
