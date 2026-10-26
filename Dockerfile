# Runtime version fixed by digest; refresh deliberately with validation.
FROM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS development
WORKDIR /workspace
RUN chown node:node /workspace
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node apps/backend/package.json apps/backend/package.json
COPY --chown=node:node apps/web/package.json apps/web/package.json
COPY --chown=node:node packages/telemetry/package.json packages/telemetry/package.json
USER node
RUN npm ci
# Fetch the pinned Prisma engine during the build, never on an internal runtime network.
RUN node node_modules/@prisma/engines/scripts/postinstall.js
COPY --chown=node:node . .
# Seed correct ownership for the disposable generated-client volume in local Compose.
RUN mkdir -p apps/backend/src/generated

FROM development AS verify
RUN npm run lint && npm run typecheck && npm test && npm run build

# Explicit offline maintenance image; neither API nor worker inherit pg clients.
FROM verify AS access-maintenance
USER root
RUN apk add --no-cache postgresql17-client
USER node
CMD ["node", "scripts/auth-backup.mjs"]

# Neon development uses 18; keep its recovery tooling separate from local 17.
FROM verify AS access-maintenance18
USER root
RUN apk add --no-cache postgresql18-client
USER node
CMD ["node", "scripts/auth-backup.mjs"]

# Compiled immutable backend; no watch, source bind mounts or env files.
FROM development AS backend-build
RUN npm run build --workspace @fasemarketplace/backend && npm prune --omit=dev
# npm can retain the optional Prisma CLI peer through @prisma/client; it is not
# part of the application runtime. Generated client/runtime packages stay intact.
RUN node -e "require('node:fs').rmSync('/workspace/node_modules/prisma', { recursive: true, force: true })"

FROM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS production
WORKDIR /workspace
ENV NODE_ENV=production
COPY --from=backend-build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=backend-build --chown=node:node /workspace/apps/backend/package.json ./apps/backend/package.json
COPY --from=backend-build --chown=node:node /workspace/apps/backend/dist ./apps/backend/dist
COPY --from=backend-build --chown=node:node /workspace/packages/telemetry ./packages/telemetry
COPY --chown=node:node server ./server
USER node
CMD ["node", "apps/backend/dist/main.js"]
