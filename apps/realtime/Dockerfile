# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/application/package.json packages/application/package.json
COPY packages/eventing/package.json packages/eventing/package.json
COPY apps/backend/package.json apps/backend/package.json
COPY apps/processor/package.json apps/processor/package.json
COPY apps/syncstart/package.json apps/syncstart/package.json
COPY apps/realtime/package.json apps/realtime/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci
COPY packages packages
COPY apps/realtime apps/realtime
RUN npm run build --workspace=@tournament-manager/contracts \
  && npm run build --workspace=@tournament-manager/eventing \
  && npm run build --workspace=@tournament-manager/realtime

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/application/package.json packages/application/package.json
COPY packages/eventing/package.json packages/eventing/package.json
COPY apps/backend/package.json apps/backend/package.json
COPY apps/processor/package.json apps/processor/package.json
COPY apps/syncstart/package.json apps/syncstart/package.json
COPY apps/realtime/package.json apps/realtime/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci --omit=dev
COPY --from=builder /app/packages/contracts/dist packages/contracts/dist
COPY --from=builder /app/packages/eventing/dist packages/eventing/dist
COPY --from=builder /app/apps/realtime/dist apps/realtime/dist
ENV NODE_ENV=production
EXPOSE 3003
CMD ["npm", "run", "start:prod", "--workspace=@tournament-manager/realtime"]
