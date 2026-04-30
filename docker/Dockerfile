# ── Stage 1: deps ──────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/
COPY packages/theme/package.json packages/theme/

RUN corepack enable && pnpm install --frozen-lockfile

# ── Stage 2: build ─────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
# theme has no separate node_modules (hoisted), but copy dir if it exists
RUN mkdir -p ./packages/theme/node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && \
    pnpm --filter @itsweber/theme build && \
    pnpm --filter web build

# ── Stage 3: runtime ───────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

RUN apk add --no-cache curl tini

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    DATA_DIR=/data

# Standalone output
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

# Entrypoint script
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN mkdir -p /data

# NOTE: Container runs as root by default. This is required for
# read access to /var/run/unraid-api.sock when the socket is mounted
# from an Unraid host (default mode: 750, owner root). Override at
# runtime with `--user 1001:1001` if you don't need the Unraid socket
# or if you have adjusted socket permissions on the host.
USER root

EXPOSE 3000

VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
