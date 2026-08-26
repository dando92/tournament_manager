FROM node:22-alpine
WORKDIR /app
COPY . .
RUN export NODE_OPTIONS=--max-old-space-size=1408 && npm ci && npm run build --workspace=@tournament-manager/scoring && npm run build --workspace=@tournament-manager/contracts && npm run build --workspace=@tournament-manager/live-messaging && npm run build --workspace=@tournament-manager/syncstart-protocol && npm run build --workspace=@tournament-manager/syncstart
ENV NODE_ENV=production
EXPOSE 3002
CMD ["npm", "run", "start:prod", "--workspace=@tournament-manager/syncstart"]
