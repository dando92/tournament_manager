FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/scoring/package.json packages/scoring/package.json
COPY packages/persistence/package.json packages/persistence/package.json
COPY apps/migrations/package.json apps/migrations/package.json
RUN npm ci
COPY packages/scoring packages/scoring
COPY packages/persistence packages/persistence
COPY apps/migrations apps/migrations
RUN npm run build --workspace=@tournament-manager/scoring && npm run build --workspace=@tournament-manager/persistence && npm run build --workspace=@tournament-manager/migrations

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/scoring/package.json packages/scoring/package.json
COPY packages/persistence/package.json packages/persistence/package.json
COPY apps/migrations/package.json apps/migrations/package.json
RUN npm ci --omit=dev
COPY --from=builder /app/packages/persistence/dist packages/persistence/dist
COPY --from=builder /app/packages/scoring/dist packages/scoring/dist
COPY --from=builder /app/apps/migrations/dist apps/migrations/dist
CMD ["npm", "run", "migration:run:prod", "--workspace=@tournament-manager/migrations"]
