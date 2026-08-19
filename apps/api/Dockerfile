# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/application/package.json packages/application/package.json
COPY packages/persistence/package.json packages/persistence/package.json
COPY packages/eventing/package.json packages/eventing/package.json
COPY packages/startgg/package.json packages/startgg/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/processor/package.json apps/processor/package.json
COPY apps/syncstart/package.json apps/syncstart/package.json
COPY apps/realtime/package.json apps/realtime/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/migrations/package.json apps/migrations/package.json
COPY apps/local-fixtures/package.json apps/local-fixtures/package.json
RUN npm ci
COPY packages packages
COPY apps/api apps/api
RUN npm run build --workspace=@tournament-manager/contracts \
  && npm run build --workspace=@tournament-manager/application \
  && npm run build --workspace=@tournament-manager/persistence \
  && npm run build --workspace=@tournament-manager/eventing \
  && npm run build --workspace=@tournament-manager/startgg \
  && npm run build --workspace=@tournament-manager/api

# ---- Production stage ----
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/application/package.json packages/application/package.json
COPY packages/persistence/package.json packages/persistence/package.json
COPY packages/eventing/package.json packages/eventing/package.json
COPY packages/startgg/package.json packages/startgg/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/processor/package.json apps/processor/package.json
COPY apps/syncstart/package.json apps/syncstart/package.json
COPY apps/realtime/package.json apps/realtime/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/migrations/package.json apps/migrations/package.json
COPY apps/local-fixtures/package.json apps/local-fixtures/package.json
RUN npm ci --omit=dev
COPY --from=builder /app/packages/contracts/dist packages/contracts/dist
COPY --from=builder /app/packages/application/dist packages/application/dist
COPY --from=builder /app/packages/persistence/dist packages/persistence/dist
COPY --from=builder /app/packages/eventing/dist packages/eventing/dist
COPY --from=builder /app/packages/startgg/dist packages/startgg/dist
COPY --from=builder /app/apps/api/dist apps/api/dist
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start:prod", "--workspace=@tournament-manager/api"]
