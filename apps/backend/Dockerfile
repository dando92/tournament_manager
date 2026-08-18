# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci --workspace=tournament_manager_backend
COPY apps/backend apps/backend
RUN npm run build --workspace=tournament_manager_backend

# ---- Production stage ----
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci --omit=dev --workspace=tournament_manager_backend
COPY --from=builder /app/apps/backend/dist apps/backend/dist
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start:prod", "--workspace=tournament_manager_backend"]
