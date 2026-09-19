# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# CronFlow production image (multi-stage)
#   build   → install all dependencies, generate the Prisma client, compile, prune dev deps
#   runtime → slim Node image running as a non-root user
#
# One image, two roles:
#   API     node dist/main.js     (default CMD)
#   Worker  node dist/worker.js
# Set RUN_MIGRATIONS=true to apply `prisma migrate deploy` before the process starts.
# ─────────────────────────────────────────────────────────────────────────────
ARG NODE_VERSION=22

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app

# Prisma's engines need OpenSSL.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Dependencies first, so this layer stays cached until the lockfile changes.
# The Prisma schema is required here because `postinstall` runs `prisma generate`.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build \
    && npm prune --omit=dev

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    CHECKPOINT_DISABLE=1
WORKDIR /app

# tini runs as PID 1 and forwards SIGTERM, so Nest shutdown hooks run on `docker stop`:
# the worker finishes in-flight jobs and connections close cleanly.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl tini \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY docker/entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh

# Application files stay root-owned and read-only; the process runs unprivileged.
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health/live').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["tini", "--", "docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
