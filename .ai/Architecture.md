# Target Scalable Architecture

## Purpose and Status

This document defines the approved target architecture and the constraints for migrating the current monolithic NestJS backend. It is the primary source for architectural migration decisions.

The architecture must remain independent from hosting, database, and Redis providers. Deployment products are runtime choices, not application dependencies.

## Target Topology

```text
apps/
  api/          HTTP API and synchronous application entrypoints
  processor/    Stateless internal event handlers and outbox relay
  syncstart/    Persistent SyncStart connections and protocol adapter
  realtime/     Browser WebSocket connections and event fan-out
  frontend/     React and Vite application

packages/
  application/  Reusable managers and application use cases
  contracts/    Versioned commands, domain events, and UI events
  eventing/     Outbox, inbox, Redis Streams, and Redis Pub/Sub adapters
```

All applications remain in the same monorepo but must be independently buildable and deployable as Docker containers.

## Service Boundaries

### API

- Exposes HTTP commands, queries, authentication, and authorization.
- Executes synchronous application use cases.
- Owns CRUD operations, persisted tournament state, and complete read snapshots.
- Keeps request/response integrations such as Start.gg unless they later require asynchronous execution.
- Produces durable events through the transactional outbox.
- Does not maintain WebSocket connections.

### Processor

- Consumes durable commands and events from Redis Streams.
- Hosts stateless event handlers, projections, notifications, retries, and the outbox relay.
- Uses an inbox to provide idempotent processing.
- Invokes application use cases and services; it does not duplicate domain logic.
- Does not expose public controllers or WebSocket gateways.

The processor is an execution model, not a replacement for the manager layer. Managers and application use cases belong in shared application code when both API entrypoints and processor handlers need them.

Current manager migration guidance:

- Controller-invoked manager operations remain synchronous API use cases.
- `LobbyManager` connection ownership moves to the SyncStart service.
- The SyncStart observer behavior currently inside `StandingManager` becomes processor event handlers.
- `MatchWorkflowManager` and `AdvancementManager` remain reusable application logic invoked by API commands or processor handlers.
- Move individual event-driven use cases, not entire manager classes by naming convention.

Phase 4 established the first extraction-ready registered handler for `syncstart.song-completed` version 1. The handler atomically records inbox progress with score, standing, and recalculation effects. SyncStart connection/session ownership remains in the current backend until Phase 6; browser gateway caches remain replaceable state until Phase 7.

### SyncStart

- Owns the SyncStart protocol and all persistent outbound WebSocket connections.
- Owns reconnection, lobby sessions, connector ownership, and protocol parsing.
- Consumes durable SyncStart commands from Redis Streams.
- Publishes critical SyncStart outcomes to Redis Streams.
- Publishes replaceable high-frequency telemetry to Redis Pub/Sub.
- Does not contain frontend DTOs, UI routing, bracket logic, or persistence orchestration.

### UI Realtime

- Owns inbound browser WebSocket connections, authentication, rooms, and subscriptions.
- Consumes prepared UI events and broadcasts them to connected clients.
- Uses Redis Pub/Sub for fan-out across service replicas.
- May keep volatile connection and snapshot caches, but never authoritative application state.
- Does not calculate standings, advance brackets, persist results, or interpret the SyncStart protocol.

### Frontend

- Uses HTTP snapshots as the authoritative view state.
- Uses WebSocket messages only for incremental updates.
- Reconnects automatically and reloads a snapshot after disconnection or a detected sequence gap.

## Application Logic

Application logic must be stateless. An API controller or processor handler loads required state, invokes a use case, persists the result, emits new events, and then discards local state.

Examples of stateless application processing include:

- standings recalculation;
- bracket advancement;
- persisted match and lobby state transitions;
- song result persistence;
- read-model projections;
- notifications;
- domain-event to UI-event projection;
- cache invalidation;
- Start.gg request/response synchronization.

Multi-event workflows must persist their state in PostgreSQL. In-memory workflow state is not authoritative.

## Event Transport

Redis is part of the target architecture from the first eventing implementation.

### Durable Events and Commands

Durable traffic uses Redis Streams and consumer groups. Examples include SyncStart connection commands, lobby lifecycle changes, completed songs, recorded results, completed matches, and bracket advancement.

For changes originating in a PostgreSQL transaction, the required flow is:

```text
Application transaction -> PostgreSQL outbox -> outbox relay -> Redis Streams -> consumer inbox -> handler
```

The processor must not poll the outbox as its business-event transport. The outbox exists to guarantee atomic publication to Redis Streams.

Processing guarantees are at-least-once. Every handler must therefore be idempotent. Inbox uniqueness is based on consumer identity and event ID. Failed events must support bounded retries and a dead-letter stream.

### Live Replaceable Events

High-frequency values whose newest snapshot replaces previous values use Redis Pub/Sub. Examples include live score percentage, judgments, song progress, player screen, ready state, and heartbeat information.

These events do not use the transactional outbox. Missing an intermediate live event is acceptable because the next event or an HTTP snapshot restores the current view.

### Event Contracts

Commands and events are versioned contracts and must not expose database entities. Every durable envelope includes at least:

```text
id
type
version
aggregateId
occurredAt
correlationId
causationId
payload
```

UI realtime events additionally include the relevant tournament scope and a sequence number when ordered incremental delivery is required.

## State Ownership

- PostgreSQL is the authoritative transactional store.
- Neon is the current PostgreSQL provider, not an architectural dependency.
- Redis Streams transports durable events and commands; it is not the system of record.
- Redis Pub/Sub transports replaceable live updates.
- SyncStart keeps unavoidable volatile connection state.
- UI Realtime keeps browser connection state only.
- Frontend state is recoverable from API snapshots.

Use standard PostgreSQL, Redis, and Docker interfaces. Do not introduce provider-specific APIs into application or domain code.

## Persistence and Reliability

- Disable TypeORM schema synchronization in every environment.
- Apply versioned database migrations before application rollout.
- The current pre-production database is disposable. Until production is explicitly declared, schema changes may establish a clean migration baseline without compatibility logic for earlier test schemas.
- Before the first production deployment, define and approve forward data-migration, rollback, and compatibility requirements; later production migrations must preserve authoritative data.
- Write domain changes and outbox records in the same transaction.
- Retain outbox records long enough to support operational replay.
- Use optimistic versioning or aggregate sequence checks where event ordering matters.
- Persist workflow state, leases, and recovery checkpoints.
- Treat graceful shutdown, lease release, reconnection, and replay as required behavior for stateful services.

### Tournament lifecycle and transport retention

- Tournament-scoped durable events use the tournament ID as `aggregateId`; entity-specific IDs remain in the payload.
- A tournament is either `open` or `closed`. Closing is an explicit authorized action, records `closedAt`, disconnects its SyncStart lobbies, and makes every tournament mutation require a prior reopen.
- Reopening clears `closedAt` and prevents a later sweep from selecting the tournament. A retention sweep that already selected the tournament is allowed to finish without lifecycle coordination. Reopening after a completed purge is allowed and does not reconstruct deleted transport history.
- After a configurable number of continuously closed days, all transport data for the tournament is deleted: outbox, inbox, technical event projections, Redis Stream entries, pending state, retry state, and dead-letter entries.
- Redis Pub/Sub traffic is ephemeral and has no retained history to purge.
- Retention uses bounded PostgreSQL batches, a per-tournament Redis transport index, and one global PostgreSQL advisory lock so it is idempotent and only one service replica sweeps at a time.
- Application use cases do not access TypeORM or lock SQL directly. Focused PostgreSQL persistence adapters own transactions and obtain repositories from their transaction `EntityManager`; a dedicated PostgreSQL advisory-lock infrastructure class centralizes the global sweep lock's session semantics.
- Ordinary tournament mutations check the open-state invariant at entry but do not all acquire a tournament row lock. The rare race with manual closure is an accepted pre-production tradeoff; stronger serialization must be reconsidered explicitly before production if required.
- Retention does not acquire a per-tournament advisory lock, repeat its eligibility query, or coordinate with manual close and reopen operations. These rare human-operation races are accepted to keep the implementation simple.
- Advisory locks remain an explicit PostgreSQL capability, not a nominally database-neutral distributed-lock abstraction. Provider independence refers to deployment/cloud providers; PostgreSQL remains the authoritative supported database.
- Closed tournaments remain readable. Lifecycle state and authoritative tournament data are not deleted by transport retention.

## Deployment

- GitHub Actions is the release control plane.
- Build immutable Docker images tagged with the Git commit SHA.
- Run lint, tests, and builds before deployment.
- Apply migrations, deploy services, verify health, and run smoke tests.
- Keep secrets in deployment environments, never in images or repository files.
- Provider-native source builds may be used only if they preserve the same container contract and rollback capability.

## Local Runtime

The `local` configuration is a first-class deployment target, not an ad hoc developer setup.

- The complete application must start on a local server with one documented Docker Compose command.
- The local stack must include every required runtime dependency, including PostgreSQL and Redis.
- PostgreSQL is the only supported database in the migrated system; SQLite and MariaDB support must be removed.
- API, processor, SyncStart, UI realtime, frontend, database migrations, and infrastructure initialization must be orchestrated automatically.
- Local startup must not require Neon, a managed Redis provider, or any other cloud account.
- Local and hosted environments must use the same container images, protocols, event contracts, and migration mechanism. Only configuration and provider endpoints may differ.
- Persistent local data must use named volumes, and services must expose health checks so startup dependencies can be coordinated reliably.
- Developer tooling such as RedisInsight may be optional, but it must not be required to run the application.

## Migration Sequence

The executable phase plan, test requirements, and exit gates are defined in [MigrationPlan.md](MigrationPlan.md).

1. Standardize persistence on PostgreSQL, remove SQLite and MariaDB support, and define versioned contracts and persistence migrations.
2. Add Redis and provider-independent eventing interfaces to the local stack.
3. Implement outbox, relay, inbox, Redis Streams, retries, and dead-letter handling inside the existing backend.
4. Convert observer-driven domain behavior into stateless handlers without changing deployment boundaries.
5. Extract shared application use cases needed by API and processor entrypoints.
6. Extract the processor application.
7. Extract the SyncStart service and move connector ownership out of the API.
8. Extract the UI Realtime service and add snapshot-based reconnect behavior.
9. Deploy and scale services independently only after behavior is verified at each boundary.

Avoid a big-bang rewrite. Each migration step must preserve existing behavior and leave the repository buildable and testable.
