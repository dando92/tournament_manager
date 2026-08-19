# Local Platform Operations

## Prerequisites

- Node.js 22 or later
- npm
- Docker with Docker Compose v2
- Docker Desktop running when using Windows or macOS

No cloud account or provider-specific credentials are required. Compose defaults are suitable for local use; create a repository-root `.env` only when overriding ports or local credentials.

## Start and Verify

Install workspace dependencies once after cloning or changing the lockfile:

```text
npm ci
```

Build and start PostgreSQL, Redis, the migration runner, optional local fixtures, SyncStart service, two realtime replicas, API, and frontend:

```text
npm run local:up
```

The command waits for healthy services. The migration runner must complete before the API starts, and the API must become ready before the frontend starts.

Verify the running stack:

```text
npm run local:status
npm run verify:local
```

Local endpoints:

- Frontend: `http://localhost`
- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/api-docs`
- API liveness: `http://localhost:3000/health/live`
- API readiness: `http://localhost:3000/health/ready`
- SyncStart liveness and readiness: internal container endpoints on port `3002`, reported by `npm run verify:local`
- Realtime replica A: `http://localhost:3003` (health, snapshot HTTP, and browser WebSockets)
- Realtime replica B: `http://localhost:3004` (independent local fan-out replica)
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

Readiness reports PostgreSQL, Redis, and migration-runner status separately. The migration runner creates the application schema from the reviewed pre-production baseline before API readiness. TypeORM schema synchronization is disabled.

Replaceable live events use the `tournament-manager.live` Redis Pub/Sub channel. API-to-SyncStart commands and completed-song submissions use authenticated internal HTTP.

The bundled SyncStart simulator is optional and starts through the `simulator` Compose profile; a host or remote WebSocket URL may be supplied through `LOCAL_FIXTURE_SYNCSTART_URL`.

The realtime replicas subscribe independently to `LIVE_EVENT_CHANNEL`, scope every browser connection by tournament, and expose compatibility WebSocket paths at `/uiupdatehub`, `/lobbygateway`, and `/livematchgateway`. `PUBLIC_REALTIME_URL` selects the browser-facing replica. Ordered live events receive a Redis-assigned per-tournament sequence; reconnects and gaps trigger an HTTP snapshot reload. Realtime caches are replaceable and never authoritative.
The frontend container reads `PUBLIC_API_URL`, `PUBLIC_REALTIME_URL`, and `PUBLIC_AUTH_MODE` at startup and writes `/runtime-config.js`. Changing these values requires only a frontend container restart, not an image rebuild.

`LIVE_EVENT_CHANNEL` and internal HTTP settings are deploy-time configuration. A process restart is required after changing environment values. Hosted deployments use a maintenance window with platform traffic blocked and do not require rolling continuity.

The local stack runs the one-shot `local-fixtures` application and creates an idempotent `Local E2E Tournament` fixture by default. Override `LOCAL_FIXTURE_TOURNAMENT_NAME` in `.env`. Set `LOCAL_FIXTURE_SYNCSTART_URL` to a reachable host or remote SyncStart WebSocket URL; leave it empty to create the fixture without SyncStart. The bundled simulator is optional and starts only with `docker compose --profile simulator up`.

## Status and Logs

Show container health and API dependency status:

```text
npm run local:status
```

Follow logs for the complete stack:

```text
npm run local:logs
```

Use `Ctrl+C` to stop following logs; this does not stop the stack. To inspect one service directly, use `docker compose logs <service>`, where the service is `postgres`, `redis`, `migrations`, `local-fixtures`, `syncstart`, `syncstart-simulator`, `realtime-a`, `realtime-b`, `api`, or `frontend`.

## Shutdown and Restart

Stop containers without deleting PostgreSQL or Redis data:

```text
npm run local:down
```

Run `npm run local:up` again to restart with the retained named volumes. Restart only the application containers with:

```text
docker compose restart syncstart realtime-a realtime-b api frontend
```

## Backup and Restore

Create a portable plain-SQL PostgreSQL backup while the stack is running:

```text
docker compose exec -T postgres pg_dump -U tournament_manager --clean --if-exists --no-owner tournament_manager > tournament-manager-backup.sql
```

Restore it into a running local PostgreSQL container from PowerShell:

```powershell
Get-Content -Raw .\tournament-manager-backup.sql | docker compose exec -T postgres psql -U tournament_manager -d tournament_manager
```

For Bash-compatible shells:

```bash
docker compose exec -T postgres psql -U tournament_manager -d tournament_manager < tournament-manager-backup.sql
```

If local database credentials were overridden in `.env`, replace the username and database in these commands accordingly. Backups contain application data and must not be committed.

## Explicit Reset

Reset is destructive and is never part of normal startup. The following command removes the named PostgreSQL and Redis volumes, rebuilds the stack, and recreates the deterministic fixture:

```text
npm run local:reset
```

Create a backup first when the local data must be recoverable.

The current pre-production schema baseline intentionally does not upgrade databases created before Phase 2. Reset those disposable test databases with `npm run local:reset` before starting the updated stack.

## Recovery Checks

- After a normal shutdown and startup, `npm run local:status` must show retained data and all dependencies up.
- If PostgreSQL or Redis is stopped, `/health/live` remains available while `/health/ready` returns `503` and identifies the failed dependency.
- After the dependency restarts, Compose and the API health checks restore readiness without deleting volumes.
- API-to-SyncStart commands use synchronous internal HTTP. A failed request is reported to the caller and is not retained for automatic retry.
- Redis Pub/Sub live messages are replaceable and may be lost while Redis, a publisher, or a subscriber is unavailable. Authoritative state remains in PostgreSQL and clients recover through HTTP snapshots.
- Realtime may be stopped without affecting HTTP behavior or authoritative state. After reconnect or a sequence gap, the frontend reloads HTTP snapshots; only browser connections and replaceable cached telemetry are lost on restart.
- If the migration container fails, inspect `docker compose logs migrations`; the API intentionally remains stopped.
