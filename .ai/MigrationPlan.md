# Simplified Architecture Migration Plan

## Objective

Simplify Tournament Manager around the scaling boundary that actually requires isolation: SyncStart connection and lobby state. Preserve the independently deployable API, SyncStart, realtime, frontend, and database-migration applications while removing durable event infrastructure that is not justified by the product's recovery requirements.

The target topology is:

```text
Browser --HTTP----------> API
Browser --WebSocket-----> Realtime
API --internal HTTP-----> SyncStart
SyncStart --internal HTTP> API
API/SyncStart --Pub/Sub-> Redis -> Realtime replicas
SyncStart --WebSocket---> external SyncStart server
```

## Approved Principles

- The API owns synchronous tournament, match, standings, advancement, authentication, and request/response integration use cases.
- API managers and services may remain in-process when they are stateless and use PostgreSQL as authoritative state.
- SyncStart owns all SyncStart protocol connections, connector instances, lobby sessions, and volatile live-match state.
- Realtime is the only browser WebSocket endpoint. It owns browser connections and scoped fan-out, but not authoritative tournament state.
- Redis is used only for replaceable Pub/Sub fan-out from API and SyncStart to every realtime replica.
- Redis Streams, transactional outbox, consumer inbox, retries, dead letters, event retention, and the processor application are removed.
- Losing an occasional completed-song notification during a failure is an accepted product tradeoff. Tournament staff can enter the missing score manually.
- The internal API endpoint receiving completed songs is idempotent to avoid inexpensive duplicate-processing failures; no persistent delivery queue is required.
- SyncStart initially runs as one state-owning replica. Sharding or failover requires a future explicit requirement and design approval.
- PostgreSQL remains the only authoritative transactional store.
- The existing container, immutable-image, health-check, and deployment approach is retained and simplified for the smaller application set.
- Pre-production data is disposable, so the database migrations may be replaced with a clean baseline.

## Target Workspaces

```text
apps/
  api/             HTTP API and synchronous application use cases
  migrations/      One-shot PostgreSQL migration runner
  local-fixtures/  Optional one-shot local development fixtures
  syncstart/       SyncStart protocol, connections, lobby state, and live state
  realtime/        Browser WebSockets and scoped fan-out
  frontend/        React application

packages/
  application/     Reusable pure application calculations when genuinely shared
  contracts/       Transport-neutral internal DTOs and live envelopes
  persistence/     Shared PostgreSQL entity metadata and repository registration
  live-messaging/  Replaceable-message ports and Redis Pub/Sub adapters
  startgg/         Provider client, GraphQL protocol, types, parsing, pagination, and rate limiting
```

`apps/processor` and `packages/eventing` are removed. `@tournament-manager/live-messaging` replaces only the small Pub/Sub behavior that remains.

## Testable Ports and Adapters

Application and protocol logic must not import Redis clients, WebSocket gateways, or concrete HTTP clients. Use small behavior-oriented ports:

- `LiveEventPublisher` for API and SyncStart replaceable messages;
- `LiveEventSubscriber` for Realtime intake;
- `SyncStartClient` for API-to-SyncStart commands and snapshots;
- `CompletedSongSink` for SyncStart-to-API completed-song submission;
- `BrowserEventBroadcaster` for Realtime WebSocket delivery.

`@tournament-manager/contracts` owns transport-neutral DTOs and live envelopes. `@tournament-manager/live-messaging` owns publisher/subscriber ports and Redis Pub/Sub adapters. HTTP and WebSocket adapters remain in the application that owns their lifecycle.

SyncStart protocol events use focused observer interfaces instead of one interface with many optional callbacks:

- `LobbyLifecycleObserver`;
- `LiveMatchObserver`;
- `CompletedSongObserver`.

The protocol dispatcher invokes the relevant observer collection. Concrete observers translate normalized protocol events into `LiveEventPublisher` calls or `CompletedSongSink` calls. Unit tests inject in-memory fakes or spies and do not start Redis, HTTP servers, or WebSockets.

Do not add an application-wide event bus, generic mediator, or speculative abstraction. Introduce a port only at a real transport or ownership boundary.

## Implementation Blueprint

This section is prescriptive enough to guide implementation. Deviate only when existing code or tests demonstrate a concrete incompatibility, and record that decision before introducing a different abstraction.

### Shared contracts

Keep `packages/contracts` free of NestJS, Redis, TypeORM, and WebSocket dependencies. Define plain TypeScript types for:

```ts
export interface LiveEventEnvelope<TPayload = unknown> {
  type: string;
  tournamentId: number;
  payload: TPayload;
  sequence?: number;
}

export interface CompletedSongRequest {
  completionId: string;
  tournamentId: number;
  lobbyId: string;
  lobbyName: string;
  lobbyCode: string;
  song: CompletedSongData;
  scores: CompletedPlayerScore[];
}

export interface ConfigureTournamentRequest {
  tournamentId: number;
  syncstartUrl: string;
}

export interface SyncStartSnapshot {
  tournamentId: number;
  connection: SyncStartConnectionStatusDto;
  lobbies: LobbyConnectionDto[];
  liveMatches: LobbyMatchUpdateDto[];
}
```

Reuse existing normalized DTOs where their current shapes are adequate. Do not expose TypeORM entities, Redis payload types, raw SyncStart frames, or NestJS HTTP classes from the contracts package.

### Live messaging package

Create this target structure:

```text
packages/live-messaging/
  src/
    ports/
      live-event-publisher.ts
      live-event-subscriber.ts
    redis/
      redis-live-event-publisher.ts
      redis-live-event-subscriber.ts
      redis-live-messaging.options.ts
    tokens.ts
    index.ts
```

Ports:

```ts
export interface LiveEventPublisher {
  publish(event: LiveEventEnvelope): Promise<void>;
}

export interface LiveEventSubscriber {
  subscribe(
    handler: (event: LiveEventEnvelope) => void | Promise<void>,
  ): Promise<() => Promise<void>>;
}
```

Export stable NestJS injection tokens such as `LIVE_EVENT_PUBLISHER` and `LIVE_EVENT_SUBSCRIBER`. The Redis adapters receive host, port, channel, and optional sequence configuration through explicit options. Application logic injects the port token, never a Redis class.

Keep separate Redis publisher and subscriber connections because Redis subscription mode has a distinct lifecycle. Validate only the transport envelope at this trusted internal boundary. Preserve tournament sequencing only if existing browser compatibility tests require it; do not build durable replay.

### API-to-SyncStart port

Place the port and HTTP adapter under the API integration directory:

```text
apps/api/src/integrations/syncstart/
  syncstart-client.ts
  http-syncstart.client.ts
  syncstart-client.module.ts
```

```ts
export interface SyncStartClient {
  configureTournament(input: ConfigureTournamentRequest): Promise<void>;
  closeTournament(tournamentId: number): Promise<void>;
  connectServer(tournamentId: number): Promise<ConnectionStatus>;
  disconnectServer(tournamentId: number): Promise<ConnectionStatus>;
  listLobbies(tournamentId: number): Promise<TournamentLobbiesDto>;
  connectLobby(input: ConnectLobbyRequest): Promise<ConnectedLobby>;
  createLobby(input: CreateLobbyRequest): Promise<ConnectedLobby>;
  disconnectLobby(tournamentId: number, lobbyId: string): Promise<void>;
  getSnapshot(tournamentId: number): Promise<SyncStartSnapshot>;
}
```

`HttpSyncStartClient` uses platform `fetch`, a configurable base URL, a short configurable timeout, and the internal service token. It maps non-success responses to clear NestJS gateway exceptions at the adapter boundary. Unit tests inject a fake `SyncStartClient`.

### SyncStart internal HTTP surface

Add an internal controller in `apps/syncstart` with routes equivalent to:

```text
PUT    /internal/tournaments/:tournamentId/configuration
DELETE /internal/tournaments/:tournamentId/configuration
POST   /internal/tournaments/:tournamentId/server/connect
DELETE /internal/tournaments/:tournamentId/server/disconnect
GET    /internal/tournaments/:tournamentId/lobbies
POST   /internal/tournaments/:tournamentId/lobbies/connect
POST   /internal/tournaments/:tournamentId/lobbies
DELETE /internal/tournaments/:tournamentId/lobbies/:lobbyId
GET    /internal/tournaments/:tournamentId/snapshot
```

Controllers validate DTOs and invoke one SyncStart application service. That service owns connector lookup and lobby state; it does not know about HTTP response objects.

Protect every internal route with a small shared-token guard using `INTERNAL_SERVICE_TOKEN`. Keep these ports private to the container network and do not expose them through the public reverse proxy.

### SyncStart restart bootstrap

SyncStart volatile state disappears on restart. Rebuild desired connectors through a simple API bootstrap query instead of Redis state:

```text
GET /internal/syncstart/tournaments
```

The API returns open tournaments with a configured SyncStart URL. On startup, SyncStart calls this endpoint and recreates connectors. Lobby spectating state does not need durable restoration unless parity tests require it. Do not add polling or distributed ownership.

### Completed-song submission

Define the SyncStart-side port and HTTP adapter:

```ts
export interface CompletedSongSink {
  submit(song: CompletedSongRequest): Promise<void>;
}
```

```text
apps/syncstart/src/api/
  completed-song.sink.ts
  http-completed-song.sink.ts
```

The adapter calls `POST /internal/syncstart/completed-songs`. The API controller authenticates and validates the request, then calls one `CompletedSongService`. Move the existing operations from `LobbySongCompletedHandler` into that service:

1. resolve tournament, lobby, song, players, and active match;
2. create or reuse score records;
3. create or update standings;
4. recalculate completed rounds;
5. apply characterized match-completion and advancement behavior;
6. commit the PostgreSQL transaction;
7. publish replaceable match invalidations and warnings after commit.

Reprocessing the same `completionId` must not create duplicate standings. Prefer existing natural lookup/upsert behavior keyed by resolved match round, player, and song. Do not recreate a generic inbox table. If the current schema cannot provide this cheaply, record the limitation and preserve the approved best-effort behavior.

### SyncStart protocol observers

Use three focused observer roles:

```ts
export interface LobbyLifecycleObserver {
  onConnectionStatus(event: ConnectionStatusEvent): Promise<void>;
  onLobbyChanged(event: LobbyConnectionEvent): Promise<void>;
  onPlayerReady(event: PlayerReadyEvent): Promise<void>;
}

export interface LiveMatchObserver {
  onSongSelected(event: SongSelectedEvent): Promise<void>;
  onMatchUpdated(event: MatchUpdatedEvent): Promise<void>;
  onSongCompletedLive(event: SongCompletedEvent): Promise<void>;
}

export interface CompletedSongObserver {
  onSongCompleted(event: SongCompletedEvent): Promise<void>;
}
```

The dispatcher has explicit observer collections and invokes only the relevant collection. Implement a telemetry observer that maps lifecycle/live events to `LiveEventPublisher`, and a persistence observer that maps completed songs to `CompletedSongSink`.

The connector parses raw frames and produces normalized events; it does not import Redis or HTTP adapters. Observer tests use recording fakes. Preserve serialized frame handling and completion de-duplication already implemented in the connector.

### API live publication

Retain `UiUpdatePublisher` behavior but make it depend on `LiveEventPublisher`. It may query `UiUpdateContextService` to prepare the complete browser payload before publishing. Do not route GUI invalidations through SyncStart, a processor, an outbox, or an application-wide event bus.

### Realtime intake and browser delivery

Target structure:

```text
apps/realtime/src/
  live-events/
    realtime-event.service.ts
    realtime-event.mapper.ts
  browser/
    browser-event-broadcaster.ts
    websocket-browser-event.broadcaster.ts
  snapshots/
    api-snapshot.client.ts
    syncstart-snapshot.client.ts
```

`RealtimeEventService` subscribes through `LiveEventSubscriber`, maps internal envelopes to existing browser event names, and calls `BrowserEventBroadcaster`. The WebSocket gateway implements the broadcaster and owns connections and tournament subscriptions.

Keep mapping and routing unit-testable with recording fakes. Browser reconnect loads persisted state from API snapshots and volatile live state from the SyncStart snapshot endpoint. Realtime does not query PostgreSQL directly.

### Internal HTTP authentication and configuration

Use these explicit settings:

```text
INTERNAL_SERVICE_TOKEN
API_INTERNAL_URL
SYNCSTART_INTERNAL_URL
INTERNAL_HTTP_TIMEOUT_MS
LIVE_EVENT_CHANNEL
REDIS_HOST
REDIS_PORT
```

Fail startup when required hosted configuration is absent. Local Compose may provide deterministic development defaults. Never log the token or include it in DTOs.

### Migrations implementation

Create:

```text
apps/migrations/
  src/
    migration-data-source.ts
    run-migrations.ts
    migrations/
  package.json
  tsconfig.json
  Dockerfile
```

Move migration scripts and tests from the API. After durable schema removal, replace the pre-production history with one reviewed baseline containing application tables only. Remove `event_outbox`, `event_inbox`, `tournament_event_projection`, retention indexes, and compatibility code.

### Local fixtures implementation

Create a one-shot NestJS application context in `apps/local-fixtures`. It uses `packages/persistence` repositories directly and creates the deterministic tournament idempotently by name. It does not import API source or duplicate HTTP controllers.

If `LOCAL_FIXTURE_SYNCSTART_URL` is present, persist it on the fixture tournament. SyncStart discovers it through the startup bootstrap API after services start. If absent, create the tournament without SyncStart configuration. Keep simulator startup in an optional Compose profile or override.

### Start.gg package implementation

Create:

```text
packages/startgg/
  src/
    client/
      startgg.client.ts
    operations/
      queries/
      mutations/
    responses/
    startgg.types.ts
    startgg.errors.ts
    index.ts
```

The package must not import API services, tournament DTOs, repositories, entities, authorization types, or `UiUpdatePublisher`. Inject configuration into the client constructor or module options. Keep `StartggService` in the API and change only its client import and injection.

### Unit-test expectations

At minimum, add transport-free unit tests proving:

- API tournament/lobby orchestration calls a fake `SyncStartClient` with normalized input;
- SyncStart controllers delegate to connector/session application services;
- protocol events reach the correct focused observers;
- completed songs reach a fake `CompletedSongSink` once after connector de-duplication;
- the API completed-song service preserves the old processor handler's business effects;
- `UiUpdatePublisher` emits complete payloads through a fake `LiveEventPublisher`;
- Realtime maps subscribed events and invokes a fake `BrowserEventBroadcaster` with the correct tournament scope;
- Start.gg application tests inject a fake provider client.

Use integration tests only for concrete Redis Pub/Sub, internal HTTP wiring, PostgreSQL transactions, and WebSocket compatibility.

## Communication Contracts

### API to SyncStart

Use internal HTTP request/response endpoints for operations that need an immediate result, including:

- configure or close a tournament connection;
- connect or disconnect the SyncStart server;
- list, create, connect, or disconnect lobbies.

Failures are returned synchronously to the API. Do not add a command Stream, correlation channel, persistent command state, or distributed workflow.

### SyncStart to API

SyncStart calls an authenticated internal API endpoint when a song completes. The API executes the existing score, standing, recalculation, match, and advancement behavior synchronously and idempotently.

Best-effort bounded in-memory retry is allowed only if it remains simple. A process restart may lose an unpersisted score; manual entry is the accepted recovery path.

### API and SyncStart to Realtime

API and SyncStart publish replaceable live messages to Redis Pub/Sub. Every realtime replica subscribes to the same channel and forwards scoped messages to connected browsers.

- API publishes tournament-structure and match invalidations after synchronous mutations.
- SyncStart publishes connection, lobby, song, score, judgment, progress, and warning telemetry.
- Missed persisted-state invalidations recover through API HTTP snapshots.
- Realtime obtains current volatile live state from a SyncStart internal snapshot endpoint when reconnect recovery requires it.

## Start.gg Boundary

Create `@tournament-manager/startgg` containing only provider-facing code:

- GraphQL client;
- queries and mutations;
- provider request and response types;
- parsing and pagination;
- rate limiting and provider error normalization.

Keep inside `apps/api`:

- `StartggService` application orchestration;
- HTTP DTOs and authorization;
- tournament database writes and mappings;
- UI invalidation;
- synchronous completed-match reporting.

Do not convert Start.gg request/response behavior into asynchronous event processing as part of this migration. Track the currently ignored `publishToStartgg` flag as a separate functional question rather than silently changing behavior.

## Migrations and Local Fixtures

### `apps/migrations`

- Move migration ownership and the executable runner out of `apps/api`.
- Build and run it as a one-shot application before API startup.
- Replace the pre-production schema history with a clean baseline after durable event tables are removed.
- API and SyncStart readiness must not attempt to compare migration manifests. Deployment ordering is the migration-completion guarantee; runtime readiness checks only runtime dependencies.

### `apps/local-fixtures`

- Move deterministic local fixture creation out of API bootstrap.
- Run it only in the local Compose topology and allow it to be disabled.
- Create fixtures idempotently through the same API/application behavior used by ordinary tournament creation where practical.
- Make SyncStart configuration optional through `LOCAL_FIXTURE_SYNCSTART_URL`.
- Do not require the bundled simulator. A host or remote SyncStart server must be reachable through an ordinary configured WebSocket URL.
- Keep the simulator available as an optional local profile or override.

## Approved Cleanup

- Remove `AppLogger` and use the standard NestJS logger writing to container stdout/stderr.
- Remove `PostgresTournamentPersistence`.
- Put the tournament creation transaction directly in `TournamentService`.
- Use small private event/payload factory functions such as `tournamentCreatedEvent` only where a replaceable live message is actually propagated. Do not build a speculative domain-event catalog.
- Remove the technical `tournament_event_projection` and all outbox, inbox, relay, retention, advisory-lock, retry, and dead-letter code.
- Remove obsolete durable-event configuration and operational documentation.

## Execution Phases

### Phase 0 — Rebaseline and protect behavior

1. Replace the superseded architecture and migration documentation.
2. Reset the migration status record.
3. Keep existing behavioral tests for tournament, match, standings, advancement, SyncStart protocol, realtime routing, deployment, and frontend runtime configuration.
4. Add focused characterization only where a planned simplification lacks coverage.

Exit gate:

- the current branch still passes the verification appropriate to documentation-only changes;
- the simplified target and accepted reliability tradeoffs are explicit.

### Phase 1 — Extract independent support workspaces

1. Create `apps/migrations` and move the TypeORM data source, migrations, runner, scripts, image ownership, and tests.
2. Create `apps/local-fixtures` and remove `LocalSeedService` from API bootstrap.
3. Make the simulator optional and verify a configured host or remote SyncStart URL is accepted.
4. Create `@tournament-manager/startgg` and move provider-facing code without changing API behavior.
5. Remove `AppLogger`.
6. Remove `PostgresTournamentPersistence` and place the transaction in `TournamentService`.

Exit gate:

- API behavior is unchanged;
- migrations and optional fixtures run independently;
- Start.gg behavior remains synchronous and intact;
- workspace lint, tests, builds, and local smoke checks pass.

### Phase 2 — Replace Redis command/event flows with internal HTTP

1. Add authenticated internal SyncStart command endpoints.
2. Replace API command-Stream publication and command-result correlation with an internal HTTP client.
3. Add the idempotent completed-song endpoint in the API.
4. Move completed-song score, standing, recalculation, match, and advancement orchestration from the processor into that API use case.
5. Add a SyncStart client for submitting normalized completed songs to the API.
6. Preserve protocol DTO mapping and observable behavior.

Exit gate:

- tournament and lobby commands retain request/response behavior;
- completed songs persist through the API;
- the processor is no longer needed for business behavior;
- failure and manual-recovery behavior matches the approved tradeoff.

### Phase 3 — Reduce eventing to Pub/Sub and remove processor

1. Replace `packages/eventing` with `@tournament-manager/live-messaging`, containing only publisher/subscriber ports and Redis Pub/Sub adapters; keep envelopes in `packages/contracts`.
2. Publish API invalidations and SyncStart telemetry directly to Pub/Sub.
3. Keep Realtime as the only frontend WebSocket surface.
4. Add or retain the SyncStart live snapshot endpoint needed for reconnect recovery.
5. Remove `apps/processor`, Redis Streams, outbox, inbox, projections, retries, dead letters, retention, and their tests/configuration.
6. Replace migrations with the approved clean pre-production baseline.
7. Keep transport-free unit tests for API publishers, SyncStart observers, completed-song submission, Realtime mapping, and browser broadcasting.

Exit gate:

- two realtime replicas receive the same Pub/Sub messages;
- persisted state recovers through API snapshots;
- volatile live state recovers through SyncStart within the explicitly supported behavior;
- no durable-event runtime or schema artifact remains.

### Phase 4 — Simplify operations and deployment

1. Remove processor images, health checks, environment variables, deployment stages, and operational procedures.
2. Update local and hosted Compose for API, migrations, SyncStart, Realtime, frontend, PostgreSQL, and Redis.
3. Keep `apps/local-fixtures` and the simulator local-only and optional.
4. Update CI/CD image matrices, smoke checks, recovery procedures, architecture checks, and documentation.

Exit gate:

- clean local startup and retained-volume restart pass;
- production-equivalent deployment validation passes with the reduced service set;
- no removed workspace or durable-event setting is referenced.

### Phase 5 — Final parity review

1. Compare the simplified runtime against the characterized pre-migration user journeys.
2. Verify match completion/reopening, advancement invalidation, SyncStart lobby/live flows, and Start.gg integration boundaries.
3. Record suspected pre-existing behavior defects in `FunctionalQuestions.md`; do not silently broaden migration scope.
4. Remove temporary compatibility code and finalize documentation.

Exit gate:

- all approved parity journeys pass;
- the complete repository verification and local-stack verification pass;
- `MigrationStatus.md` identifies no remaining implementation step.

## Verification Rules

Each checkpoint must run verification proportional to its scope and record exact commands and results in [MigrationStatus.md](MigrationStatus.md).

The final gate includes:

```text
npm ci
npm run verify
npm run local:up
npm run verify:local
```

Also verify directly:

- optional fixture startup with no SyncStart URL;
- fixture startup against the simulator when enabled;
- configuration of a host or remote SyncStart URL;
- API-to-SyncStart internal commands;
- completed-song submission to the API;
- Pub/Sub fan-out to multiple realtime replicas;
- browser recovery from API and SyncStart snapshots;
- Start.gg package boundary and unchanged API behavior;
- migration and deployment execution without processor or durable-event artifacts.

## Explicit Non-Goals

- Exactly-once or at-least-once completed-score delivery.
- Durable command queues.
- Automatic recovery of every transient SyncStart result.
- Multi-replica SyncStart ownership, sharding, or failover.
- Database-per-service decomposition.
- An API containing no application logic.
- Replacing managers solely to create service boundaries.
- A complete domain-event taxonomy.
- Asynchronous Start.gg reporting.
- An application-wide event bus or generic mediator.
