FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build --workspace=@tournament-manager/syncstart-simulator
CMD ["npm", "run", "start", "--workspace=@tournament-manager/syncstart-simulator"]
