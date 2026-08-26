FROM node:22-alpine
WORKDIR /app
COPY . .
RUN export NODE_OPTIONS=--max-old-space-size=1408 && npm ci && npm run build --workspace=@tournament-manager/scoring && npm run build --workspace=@tournament-manager/contracts && npm run build --workspace=@tournament-manager/persistence && npm run build --workspace=@tournament-manager/live-messaging && npm run build --workspace=@tournament-manager/startgg && npm run build --workspace=@tournament-manager/api
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start:prod", "--workspace=@tournament-manager/api"]
