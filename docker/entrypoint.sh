#!/bin/sh
# Container entrypoint: optionally apply pending database migrations, then run the command
# (the API by default, or `node dist/worker.js`). `exec` hands PID ownership to the app so
# it receives shutdown signals directly.
set -eu

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."
    # Migrations need a direct connection: poolers such as Neon's don't support the locks Prisma Migrate takes.
    DATABASE_URL="${DIRECT_DATABASE_URL:-$DATABASE_URL}" ./node_modules/.bin/prisma migrate deploy
fi

exec "$@"
