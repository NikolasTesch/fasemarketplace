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
COPY --chown=node:node . .

FROM development AS verify
RUN npm run lint && npm run typecheck && npm test && npm run build

# Compiled immutable backend; no watch, source bind mounts or env files.
FROM development AS backend-build
RUN npm run build --workspace @fasemarketplace/backend && npm prune --omit=dev

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
