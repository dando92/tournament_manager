FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build --workspace=@tournament-manager/scoring && npm run build --workspace=@tournament-manager/contracts && npm run build --workspace=@tournament-manager/live-messaging && npm run build --workspace=@tournament-manager/realtime
ENV NODE_ENV=production
EXPOSE 3003
CMD ["npm", "run", "start:prod", "--workspace=@tournament-manager/realtime"]
