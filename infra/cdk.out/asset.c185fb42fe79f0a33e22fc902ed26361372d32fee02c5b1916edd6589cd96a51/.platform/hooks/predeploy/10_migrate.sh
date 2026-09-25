#!/usr/bin/env bash
set -euo pipefail

echo "[predeploy] Applying PostgreSQL migrations..."
node dist/migrate.js
echo "[predeploy] Migrations completed."
