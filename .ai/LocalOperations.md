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

Build and start PostgreSQL, Redis, the migration runner, API, and frontend:

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
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

Readiness reports PostgreSQL, Redis, and migration-runner status separately. The migration runner creates or updates the application schema from versioned migrations before API readiness. TypeORM schema synchronization is disabled.

The backend also runs the Phase 3 outbox relay and durable consumer. Durable events use the `tournament-manager.events` Stream and `tournament-manager-backend-v1` consumer group by default; exhausted messages are visible in `tournament-manager.events.dead-letter`. Replaceable live events use the `tournament-manager.live` Pub/Sub channel. These names may be overridden with `EVENT_STREAM`, `EVENT_CONSUMER_GROUP`, and `LIVE_EVENT_CHANNEL`.

Transport timing and retention are deploy-time configuration, so changing them does not require rebuilding the image. `OUTBOX_RELAY_IDLE_INTERVAL_MS`, `EVENT_CONSUMER_BLOCK_MS`, and `EVENT_RECLAIM_IDLE_MS` control eventing loops. `TOURNAMENT_TRANSPORT_RETENTION_DAYS`, `TRANSPORT_RETENTION_SWEEP_INTERVAL_MS`, and `TRANSPORT_RETENTION_BATCH_SIZE` control closed-tournament cleanup. A process restart or rolling restart is required after changing environment values.

The local stack creates an idempotent `Local E2E Tournament` fixture by default. Set `LOCAL_SEED_ENABLED=false` to disable it or override `LOCAL_SEED_TOURNAMENT_NAME` in `.env`.

## Status and Logs

Show container health and API dependency status:

```text
npm run local:status
```

Follow logs for the complete stack:

```text
npm run local:logs
```

Use `Ctrl+C` to stop following logs; this does not stop the stack. To inspect one service directly, use `docker compose logs <service>`, where the service is `postgres`, `redis`, `migrations`, `backend`, or `frontend`.

## Shutdown and Restart

Stop containers without deleting PostgreSQL or Redis data:

```text
npm run local:down
```

Run `npm run local:up` again to restart with the retained named volumes. Restart only the application containers with:

```text
docker compose restart backend frontend
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
- Outbox rows remain pending while Redis is unavailable. After Redis recovers, the relay publishes them; pending consumer entries are reclaimed after a consumer restart.
- Inspect `event_outbox.last_error` and `publish_attempts` for relay failures and the configured `.dead-letter` Stream for messages that exhausted consumer retries.
- A successful retention sweep records `tournament.transportPurgedAt`. Until that value is set, failed PostgreSQL or Redis cleanup is retried on a later sweep.
- If the migration container fails, inspect `docker compose logs migrations`; the API intentionally remains stopped.
