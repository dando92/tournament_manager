# Tournament Manager

Tournament Manager is a self-contained monorepo for managing tournaments. It contains independently deployable API, migrations, SyncStart, browser realtime, local fixtures, and frontend applications.

## Repository Structure

```text
apps/
  api/        NestJS HTTP API, synchronous use cases, and current migration ownership
  migrations/ One-shot PostgreSQL migrations
  local-fixtures/ Optional deterministic local data
  syncstart/  SyncStart protocol and connection ownership
  realtime/   Browser WebSocket fan-out and snapshots
  frontend/   React and Vite web application
packages/
  application/  Stateless shared application logic
  contracts/    Internal durable and live contracts
  live-messaging/ Redis Pub/Sub live-message transport
  persistence/  Shared PostgreSQL entity metadata
.ai/         Project architecture and design documentation
```

The API owns Start.gg request/response behavior; the SyncStart app owns its protocol and connections. Redis Pub/Sub carries replaceable live messages only. No external projects or Git submodules are required.

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

- API: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api-docs`
- Frontend: `http://localhost:5173`

Vite proxies browser API and realtime traffic through `http://localhost:5173/api/` and `http://localhost:5173/realtime/`, so a development tunnel needs to expose only port `5173`.

The dependency command starts PostgreSQL, Redis, and the one-shot migration runner. Direct development and automated persistence tests use PostgreSQL only; TypeORM schema synchronization is disabled. Runtime data and environment files are not committed.

## Docker

Start the complete provider-independent local stack with PostgreSQL and Redis:

```bash
npm run local:up
```

- Frontend: `http://localhost`
- Browser API gateway: `http://localhost/api/`
- Browser realtime gateway: `http://localhost/realtime/`
- API: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api-docs`

The frontend Nginx container is the single browser gateway. A public tunnel needs to expose only the frontend port; API, realtime, SyncStart, PostgreSQL, Redis, and the legacy bridge stay private.

Inspect and verify it with:

```bash
npm run local:status
npm run verify:local
```

Stop it without deleting data with `npm run local:down`. See [Local Platform Operations](.ai/LocalOperations.md) for logs, backup, restore, restart, recovery, and explicit reset procedures.

For a clean installation on another computer, including the legacy ITGmania bridge and optional public tunnel, follow the [New PC Setup Guide](.ai/NewPcSetup.md).

GitHub Actions verifies pull requests, publishes commit-SHA images, and promotes `main` to the pre-production testing target. See [Continuous Delivery and Testing Deployment](.ai/Deployment.md) for required environment settings and rollback behavior.

## Verification

```bash
npm run verify
```

This checks architecture boundaries, lints every workspace, runs every app unit suite, executes PostgreSQL/Redis-backed e2e tests, and builds all workspaces. Start the development dependencies first. Run `npm run verify:local` against the complete Compose stack for service readiness, migrations, API, realtime, Swagger, seed, and frontend verification.
