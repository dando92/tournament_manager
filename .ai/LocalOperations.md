# Local Platform Operations

## Resource-bounded image builds

`npm run local:up` serializes Compose image builds. This keeps the complete
stack buildable on Docker Desktop installations with approximately 2 GB of
memory, where concurrent TypeScript builds can exhaust the shared VM even
though each workspace builds independently.

API, SyncStart, and Realtime receive a 1408 MB Node heap only in their Docker
build layer. The setting is not persisted into the runtime image or applied to
the services after startup.

## Prerequisites

- Node.js 22 or later
- npm
- Docker with Docker Compose v2
- Docker Desktop running when using Windows or macOS

No cloud account or provider-specific credentials are required. Compose defaults are suitable for local use; create a repository-root `.env` only when overriding ports or local credentials.

The same repository-root `.env` supports both host development and Compose. Host processes use the loopback `API_INTERNAL_URL` and `SYNCSTART_INTERNAL_URL` values; the local Compose file deliberately replaces them with `http://api:3000` and `http://syncstart:3002` on its private network.

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
- Same-origin API gateway: `http://localhost/api/`
- Same-origin realtime gateway: `http://localhost/realtime/`
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

## Legacy ITGmania Cabinets

Older ITGmania builds broadcast UDP on port `53000` instead of speaking the SyncStart WebSocket protocol. Start the complete stack together with the compatibility bridge that translates between the two:

```text
npm run local_sync:up
```

This runs `npm run local:up` first and then starts `legacy-syncstart-bridge` as a host Node process. Running the bridge on the host lets limited UDP broadcasts reach cabinets on the physical LAN when Docker Desktop would otherwise confine them to its virtual network. The bridge listens on `53000/udp` and `1337/tcp`, and creates a virtual lobby whose code is `LEGACY_BRIDGE_LOBBY_CODE`, `BRDG` by default.

The bridge remains in the foreground so its logs stay visible. Use `Ctrl+C` to stop it; the detached Compose stack continues running and is stopped separately with `npm run local:down`.

The local fixture is not repointed: configure the tournament's SyncStart URL to `ws://host.docker.internal:1337`, connect the server from the tournament header, and the bridge lobby appears in the lobby list.

ITGmania broadcasts to the local link, so the host running the bridge must be on the cabinets' network segment. Check delivery by playing a song on a cabinet and watching the foreground bridge logs: a received song reports `Song session started` and a finished one reports `Song completed`. Nothing in the log after a played song means the datagrams are not arriving, which is a host networking question and not a bridge one. Alternative container networking modes are documented in [Legacy ITGmania SyncStart bridge](LegacySyncStartBridge.md).

The local stack runs two realtime replicas deliberately. They are not local capacity: they verify that Pub/Sub fan-out converges across replicas without client affinity, which is the property `npm run verify:local` checks and `npm run check:architecture` enforces. A hosted deployment may run a single instance without changing this local contract.

The realtime replicas subscribe independently to `LIVE_EVENT_CHANNEL`, scope every browser connection by tournament, and expose compatibility WebSocket paths at `/uiupdatehub`, `/lobbygateway`, and `/livematchgateway`. The browser reaches replica A through the frontend Nginx `/realtime/` gateway by default. Ordered live events receive a Redis-assigned per-tournament sequence; reconnects and gaps trigger an HTTP snapshot reload. Realtime caches are replaceable and never authoritative.
The frontend container reads `PUBLIC_API_URL` and `PUBLIC_REALTIME_URL` at startup and writes `/runtime-config.js`. Their local defaults are the same-origin `/api/` and `/realtime/` gateway paths. Changing these values requires only a frontend container restart, not an image rebuild.

## Remote browser access

Nginx is the single browser gateway for the complete Compose stack. A tunnel needs to expose only `http://localhost`; API requests and browser WebSockets remain same-origin and are proxied across the private Compose network. For example:

```text
cloudflared tunnel --url http://localhost
```

Direct API and realtime host ports remain available for diagnostics and verification, but they do not need to be internet-accessible. The gateway does not expose PostgreSQL, Redis, SyncStart, or the legacy SyncStart bridge. Cabinet broadcasts and the bridge continue to use the venue LAN and `ws://host.docker.internal:1337` independently of browser traffic.

`LIVE_EVENT_CHANNEL` and internal HTTP settings are deploy-time configuration. A process restart is required after changing environment values. Hosted deployments use a maintenance window with platform traffic blocked and do not require rolling continuity.

## Signing In Locally

The migration runner seeds an administrator account from `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD` in the repository-root `.env`. Sign in through the normal login form with those credentials; local and deployed environments use the same authentication path and the same account model.

The seed only creates the account when it does not already exist. Changing `INITIAL_ADMIN_PASSWORD` after the account exists has no effect; either change the password through the application or start from a clean database with `npm run local:reset`.

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

Use `Ctrl+C` to stop following logs; this does not stop the stack. To inspect one service directly, use `docker compose logs <service>`, where the service is `postgres`, `redis`, `migrations`, `local-fixtures`, `syncstart`, `syncstart-simulator`, `legacy-syncstart-bridge`, `realtime-a`, `realtime-b`, `api`, or `frontend`.

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
