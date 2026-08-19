# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/application/package.json packages/application/package.json
COPY packages/persistence/package.json packages/persistence/package.json
COPY packages/eventing/package.json packages/eventing/package.json
COPY packages/startgg/package.json packages/startgg/package.json
COPY apps/migrations/package.json apps/migrations/package.json
COPY apps/local-fixtures/package.json apps/local-fixtures/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/processor/package.json apps/processor/package.json
COPY apps/syncstart/package.json apps/syncstart/package.json
COPY apps/realtime/package.json apps/realtime/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci
COPY packages packages
COPY apps/syncstart apps/syncstart
RUN npm run build --workspace=@tournament-manager/contracts \
  && npm run build --workspace=@tournament-manager/eventing \
  && npm run build --workspace=@tournament-manager/syncstart

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/application/package.json packages/application/package.json
COPY packages/persistence/package.json packages/persistence/package.json
COPY packages/eventing/package.json packages/eventing/package.json
COPY packages/startgg/package.json packages/startgg/package.json
COPY apps/migrations/package.json apps/migrations/package.json
COPY apps/local-fixtures/package.json apps/local-fixtures/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/processor/package.json apps/processor/package.json
COPY apps/syncstart/package.json apps/syncstart/package.json
COPY apps/realtime/package.json apps/realtime/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci --omit=dev
COPY --from=builder /app/packages/contracts/dist packages/contracts/dist
COPY --from=builder /app/packages/eventing/dist packages/eventing/dist
COPY --from=builder /app/apps/syncstart/dist apps/syncstart/dist
ENV NODE_ENV=production
EXPOSE 3002
CMD ["npm", "run", "start:prod", "--workspace=@tournament-manager/syncstart"]
