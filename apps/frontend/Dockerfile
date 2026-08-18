# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci --workspace=tournament-viewer
COPY apps/frontend apps/frontend
# VITE_PUBLIC_API_URL must be passed at build time via --build-arg
ARG VITE_PUBLIC_API_URL
ARG VITE_PUBLIC_ENABLE_LIVE_SCORES=true
ENV VITE_PUBLIC_API_URL=$VITE_PUBLIC_API_URL
ENV VITE_PUBLIC_ENABLE_LIVE_SCORES=$VITE_PUBLIC_ENABLE_LIVE_SCORES
RUN npm run build --workspace=tournament-viewer

# ---- Serve stage ----
FROM nginx:alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
