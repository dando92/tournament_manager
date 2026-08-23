FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build --workspace=@tournament-manager/legacy-syncstart-bridge
ENV NODE_ENV=production
USER node
EXPOSE 1337
EXPOSE 53000/udp
CMD ["npm", "run", "start", "--workspace=@tournament-manager/legacy-syncstart-bridge"]
