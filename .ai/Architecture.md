# Target Architecture

## Purpose and Status

This document defines the implemented simplified architecture. Redis Streams, outbox, inbox, and durable-event processing are not part of the runtime.

## Topology

```text
Browser --HTTP----------> API
Browser --WebSocket-----> Realtime
API --internal HTTP-----> SyncStart
SyncStart --internal HTTP> API
API/SyncStart --Pub/Sub-> Redis -> Realtime replicas
SyncStart --WebSocket---> external SyncStart server
```

PostgreSQL is authoritative for application data. Redis carries replaceable live messages only.

## Application Boundaries

### API

- Owns HTTP, authentication, authorization, PostgreSQL transactions, and synchronous tournament use cases.
- Keeps stateless managers and services for tournament, bracket, match, standings, advancement, and API-owned integrations.
- Calls SyncStart internal HTTP endpoints for connection and lobby commands.
- Receives normalized completed songs through an authenticated idempotent internal endpoint and applies the existing persistence and advancement behavior synchronously.
- Publishes replaceable UI invalidations through Redis Pub/Sub.
- Does not own SyncStart protocol connections or browser WebSockets.

### SyncStart

- Exclusively owns SyncStart protocol WebSockets, connector instances, lobby sessions, reconnection, and volatile live state.
- Exposes internal HTTP command and snapshot endpoints to the API and Realtime services.
- Submits completed songs to the API over internal HTTP.
- Publishes replaceable live telemetry through Redis Pub/Sub.
- Initially runs as a single state-owning replica. Horizontal ownership is deferred until explicitly required.

### Realtime

- Is the only browser WebSocket surface.
- Subscribes to Redis Pub/Sub and forwards messages to tournament-scoped clients.
- Performs no domain mutation and owns no authoritative application state.
- Uses `RealtimeEventService` as the subscription and routing coordinator, `WebSocketBrowserEventBroadcaster` as the browser transport owner, and one `TournamentRealtimeState` per observed tournament and replica for replaceable sequencing and snapshots.
- Keeps replica-local tournament projections independent and reconstructible; they never determine replica ownership or require client affinity.
- Recovers persisted state through API snapshots and volatile live state through SyncStart snapshots.
- May run multiple replicas because every replica receives the same Pub/Sub messages.

### Migrations

- `apps/migrations` is the one-shot owner of the executable PostgreSQL migration lifecycle.
- It completes before application services start.
- Readiness checks runtime dependencies, not migration manifests.

### Local Fixtures

- `apps/local-fixtures` creates optional deterministic local data and never runs in hosted deployment.
- SyncStart configuration is optional through `LOCAL_FIXTURE_SYNCSTART_URL`.
- The bundled simulator is optional; host and remote SyncStart servers are supported through ordinary WebSocket URLs.

## Package Boundaries

- `packages/scoring`: scoring-system identifiers, pure score calculations, and their provider registry.
- `packages/persistence` uses scoring-system identifiers as TypeScript field types while PostgreSQL stores their stable string values.
- `packages/contracts`: transport-neutral SyncStart DTOs and internal HTTP request contracts.
- `packages/persistence`: PostgreSQL entity metadata and NestJS repository registration.
- `packages/live-messaging`: generic event envelopes, validation, publisher/subscriber ports, NestJS tokens, and Redis or in-memory transports.
- `packages/syncstart-protocol`: external SyncStart WebSocket protocol client, lobby connection primitives, protocol DTOs, normalized lobby events, and deterministic simulator. It depends only on contracts and WebSocket transport.
- `packages/startgg`: Start.gg GraphQL client, queries, mutations, provider types, parsing, pagination, rate limiting, and provider error normalization.

Start.gg application orchestration, HTTP DTOs, authorization, database writes, mappings, UI invalidation, and synchronous match reporting remain inside the API.

## Ports and Adapters

Business and protocol logic depends on behavior-oriented interfaces rather than transports:

- API and SyncStart depend on `LiveEventPublisher`;
- Realtime depends on `LiveEventSubscriber` and `BrowserEventBroadcaster`;
- API depends on `SyncStartClient` for commands and snapshots;
- SyncStart depends on `CompletedSongSink` for API submission.

Redis Pub/Sub and the in-memory test transport implement the live publisher/subscriber ports. Internal HTTP implements `SyncStartClient` and `CompletedSongSink`. `WebSocketBrowserEventBroadcaster` implements `BrowserEventBroadcaster` and owns the HTTP upgrade and browser-connection lifecycle. `TournamentRealtimeState` owns the replaceable local projection consumed through `RealtimeSnapshotReader`; `RealtimeEventService` coordinates these ports without inspecting their internal state. SyncStart DTOs come from `packages/contracts`; generic envelopes and transport abstractions come from `packages/live-messaging`.

SyncStart protocol dispatch uses the `ILobbyObserver` contract. The SyncStart application supplies a `LobbyCatalog` projection and a live-event publisher; the protocol package remains independent of NestJS, Redis, and internal HTTP. Protocol unit tests use the deterministic simulator and require no application runtime.

Do not introduce a generic application event bus. Ports exist only where code crosses a transport or service-ownership boundary.

## Communication and Reliability

- API-to-SyncStart commands are synchronous internal HTTP request/response calls.
- SyncStart-to-API completed-song submission is idempotent but not durably queued.
- An occasional score lost during a process or network failure is an accepted operational tradeoff and can be entered manually.
- API and SyncStart publish replaceable live messages to Redis Pub/Sub after their local operation succeeds.
- Missing a Pub/Sub message is acceptable because a browser can recover from a newer message or an authoritative snapshot.
- Do not add Redis Streams, outbox, inbox, retries, dead letters, retention, distributed locks, or a processor without a new explicit reliability requirement and user approval.

## Persistence and Transactions

- PostgreSQL is the only authoritative transactional store.
- TypeORM schema synchronization is disabled.
- Versioned migrations run before application rollout.
- Use `DataSource.transaction()` directly in the application service that owns a multi-write invariant.
- Obtain participating repositories from the transaction `EntityManager`.
- Dedicated persistence classes require real reuse, a replaceable interface, or substantial infrastructure behavior.
- Ordinary stateless managers do not need extraction into separate processes merely to permit API scaling.

## Realtime Event Classes

Replaceable messages include:

- tournament, division, phase, phase-group, and match invalidations from the API;
- SyncStart connection and lobby status;
- song selection and completion telemetry;
- player readiness, score, judgment, and progress telemetry;
- best-effort warnings.

These are not durable domain events and do not require an outbox or handler registry.

## Deployment

- API, migrations, SyncStart, Realtime, and frontend retain independent images and health checks.
- PostgreSQL and Redis remain provider-independent runtime dependencies.
- Local and hosted environments use the same application images and protocols; local fixtures and the simulator are optional local-only additions.
- Images remain immutable and identified by Git commit SHA.
- Migration failure prevents dependent application services from starting.

## Deferred Decisions

- Multi-replica SyncStart ownership, sharding, and failover.
- Stronger completed-score delivery guarantees.
- Changes to the existing synchronous Start.gg reporting semantics.
