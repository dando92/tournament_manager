FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/persistence/package.json packages/persistence/package.json
COPY packages/eventing/package.json packages/eventing/package.json
COPY apps/local-fixtures/package.json apps/local-fixtures/package.json
RUN npm ci
COPY packages packages
COPY apps/local-fixtures apps/local-fixtures
RUN npm run build --workspace=@tournament-manager/contracts && npm run build --workspace=@tournament-manager/persistence && npm run build --workspace=@tournament-manager/eventing && npm run build --workspace=@tournament-manager/local-fixtures

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/persistence/package.json packages/persistence/package.json
COPY packages/eventing/package.json packages/eventing/package.json
COPY apps/local-fixtures/package.json apps/local-fixtures/package.json
RUN npm ci --omit=dev
COPY --from=builder /app/packages/contracts/dist packages/contracts/dist
COPY --from=builder /app/packages/persistence/dist packages/persistence/dist
COPY --from=builder /app/packages/eventing/dist packages/eventing/dist
COPY --from=builder /app/apps/local-fixtures/dist apps/local-fixtures/dist
CMD ["npm", "run", "start", "--workspace=@tournament-manager/local-fixtures"]
