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
npm run dev:dependencies
npm run dev
```

- Backend API: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api-docs`
- Frontend: `http://localhost:5173`

The dependency command starts PostgreSQL, Redis, and the one-shot migration runner. Direct development and automated persistence tests use PostgreSQL only; TypeORM schema synchronization is disabled. Runtime data and environment files are not committed.

## Docker

Start the complete provider-independent local stack with PostgreSQL and Redis:

```bash
npm run local:up
```

- Frontend: `http://localhost`
- Backend API: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api-docs`

Inspect and verify it with:

```bash
npm run local:status
npm run verify:local
```

Stop it without deleting data with `npm run local:down`. See [Local Platform Operations](.ai/LocalOperations.md) for logs, backup, restore, restart, recovery, and explicit reset procedures.

## Verification

```bash
npm run verify
```

This runs linting, backend unit tests, PostgreSQL-backed behavioral e2e tests, and all workspace builds. Start the development dependencies first. Run `npm run verify:local` against the complete Compose stack for PostgreSQL, Redis, migrations, API, Swagger, seed, and frontend verification.
