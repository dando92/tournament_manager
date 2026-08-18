# Tournament Manager

Tournament Manager is a self-contained monorepo for managing tournaments. It includes a NestJS backend and a React frontend, together with the integrations implemented by the backend.

## Repository Structure

```text
apps/
  backend/   NestJS API, persistence, WebSocket gateways, and integrations
  frontend/  React and Vite web application
.ai/         Project architecture and design documentation
```

The Start.gg and SyncStart integrations are part of the backend. No external projects or Git submodules are required.

## Requirements

- Node.js 22 or later
- npm
- Docker and Docker Compose, when running the containerized stack

## Local Development

Install all workspace dependencies:

```bash
npm ci
```

Copy `.env.example` to `.env`, then start both applications in local authentication mode:

```bash
npm run dev
```

- Backend API: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api-docs`
- Frontend: `http://localhost:5173`

The backend uses a local SQLite database by default. Runtime databases and environment files are not committed.

## Docker

Build and run the complete application:

```bash
docker compose up --build
```

- Frontend: `http://localhost`
- Backend API: `http://localhost:3000`

## Verification

```bash
npm run build
npm test
npm run lint
```
