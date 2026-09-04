# syntax=docker/dockerfile:1

# Every image in the stack is a target of this file.
#
# Each service used to own a Dockerfile that copied the whole repository and
# then ran its own `npm ci` plus its own chain of workspace builds. Six images
# therefore repeated one ~1000-package install and recompiled the shared
# packages six times, and because the install came after `COPY . .`, editing
# any source file invalidated all of it. Here the install and the monorepo
# build happen once, in stages every target shares.

# ---- Workspace manifests ----
# Only the manifests and the lockfile reach this stage, so editing application
# source leaves the install layers cached.
FROM node:22-alpine AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/scoring/package.json packages/scoring/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/persistence/package.json packages/persistence/package.json
COPY packages/live-messaging/package.json packages/live-messaging/package.json
COPY packages/syncstart-protocol/package.json packages/syncstart-protocol/package.json
COPY packages/startgg/package.json packages/startgg/package.json
COPY apps/migrations/package.json apps/migrations/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/syncstart/package.json apps/syncstart/package.json
COPY apps/realtime/package.json apps/realtime/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY tools/syncstart-simulator/package.json tools/syncstart-simulator/package.json
COPY tools/dataset-seeder/package.json tools/dataset-seeder/package.json
COPY tools/legacy-syncstart-bridge/package.json tools/legacy-syncstart-bridge/package.json

# ---- Build dependencies ----
FROM manifests AS build-dependencies
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ---- Runtime dependencies ----
# A separate install so the runtime images carry no build tooling. It shares
# the manifests layer and the npm cache with the build install.
FROM manifests AS runtime-dependencies
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --no-audit --no-fund

# ---- Monorepo build ----
# One TypeScript and Vite pass for the whole repository. The build script
# schedules workspaces against the dependency graph and runs as many at once as
# the Docker VM's memory allows.
#
# Node sizes its heap from the VM's memory, which on a 2 GB Docker VM lands
# near 985 MB and is not enough to compile this repository. The setting below
# raises the heap for the build layer only; it is not carried into any runtime
# image. It bounds one build process, so it must stay under the per-build
# memory the build script assumes when it picks its concurrency.
FROM build-dependencies AS build
ENV NODE_OPTIONS=--max-old-space-size=1408
COPY . .
RUN npm run build

# ---- Shared Node runtime ----
# Runtime dependencies, the workspace manifests npm needs to resolve the
# workspace symlinks, and the compiled shared packages. Every Node image below
# adds only its own build output on top of this single shared layer set.
FROM node:22-alpine AS node-runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=runtime-dependencies /app ./
COPY --from=build /app/packages/scoring/dist packages/scoring/dist
COPY --from=build /app/packages/contracts/dist packages/contracts/dist
COPY --from=build /app/packages/persistence/dist packages/persistence/dist
COPY --from=build /app/packages/live-messaging/dist packages/live-messaging/dist
COPY --from=build /app/packages/syncstart-protocol/dist packages/syncstart-protocol/dist
COPY --from=build /app/packages/startgg/dist packages/startgg/dist

# ---- Migration runner ----
FROM node-runtime AS migrations
COPY --from=build /app/apps/migrations/dist apps/migrations/dist
CMD ["npm", "run", "migration:run:prod", "--workspace=@tournament-manager/migrations"]

# ---- API ----
FROM node-runtime AS api
COPY --from=build /app/apps/api/dist apps/api/dist
EXPOSE 3000
CMD ["npm", "run", "start:prod", "--workspace=@tournament-manager/api"]

# ---- SyncStart ----
FROM node-runtime AS syncstart
COPY --from=build /app/apps/syncstart/dist apps/syncstart/dist
EXPOSE 3002
CMD ["npm", "run", "start:prod", "--workspace=@tournament-manager/syncstart"]

# ---- Realtime ----
FROM node-runtime AS realtime
COPY --from=build /app/apps/realtime/dist apps/realtime/dist
EXPOSE 3003
CMD ["npm", "run", "start:prod", "--workspace=@tournament-manager/realtime"]

# ---- SyncStart protocol simulator ----
FROM node-runtime AS syncstart-simulator
COPY --from=build /app/tools/syncstart-simulator/dist tools/syncstart-simulator/dist
CMD ["npm", "run", "start", "--workspace=@tournament-manager/syncstart-simulator"]

# ---- Dataset seeder ----
# Not part of the running stack. It exists as an image so a measured run can
# write its dataset from inside the Compose network, against the same database
# the services use, without a local toolchain.
FROM node-runtime AS dataset-seeder
COPY --from=build /app/tools/dataset-seeder/dist tools/dataset-seeder/dist
CMD ["npm", "run", "start", "--workspace=@tournament-manager/dataset-seeder"]

# ---- Legacy ITGmania bridge ----
FROM node-runtime AS legacy-syncstart-bridge
COPY --from=build /app/tools/legacy-syncstart-bridge/dist tools/legacy-syncstart-bridge/dist
USER node
EXPOSE 1337
EXPOSE 53000/udp
CMD ["npm", "run", "start", "--workspace=@tournament-manager/legacy-syncstart-bridge"]

# ---- Frontend ----
FROM nginx:alpine AS frontend
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/frontend/runtime-config.template.js /etc/tournament-manager/runtime-config.template.js
COPY apps/frontend/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh
ENV PUBLIC_API_URL=/api/ \
    PUBLIC_REALTIME_URL=/realtime/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
