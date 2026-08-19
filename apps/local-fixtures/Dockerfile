FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build --workspace=@tournament-manager/scoring && npm run build --workspace=@tournament-manager/persistence && npm run build --workspace=@tournament-manager/local-fixtures
ENV NODE_ENV=production
CMD ["npm", "run", "start", "--workspace=@tournament-manager/local-fixtures"]
