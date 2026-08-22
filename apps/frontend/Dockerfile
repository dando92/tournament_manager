# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/scoring/package.json packages/scoring/package.json
COPY packages/persistence/package.json packages/persistence/package.json
COPY packages/live-messaging/package.json packages/live-messaging/package.json
COPY packages/startgg/package.json packages/startgg/package.json
COPY apps/migrations/package.json apps/migrations/package.json
COPY apps/local-fixtures/package.json apps/local-fixtures/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/syncstart/package.json apps/syncstart/package.json
COPY apps/realtime/package.json apps/realtime/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci --workspace=tournament-viewer --workspace=@tournament-manager/contracts --workspace=@tournament-manager/scoring
# The viewer reads its response types from the contracts package, which reads
# ScoringSystemType from scoring. Both are built here, in dependency order.
COPY packages/scoring packages/scoring
COPY packages/contracts packages/contracts
COPY apps/frontend apps/frontend
RUN npm run build --workspace=@tournament-manager/scoring && npm run build --workspace=@tournament-manager/contracts && npm run build --workspace=tournament-viewer

# ---- Serve stage ----
FROM nginx:alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/frontend/runtime-config.template.js /etc/tournament-manager/runtime-config.template.js
COPY apps/frontend/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh
ENV PUBLIC_API_URL=http://localhost:3000/ \
    PUBLIC_REALTIME_URL=http://localhost:3003/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
