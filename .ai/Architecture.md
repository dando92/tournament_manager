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

Phase 4 established a common registered-consumer lifecycle for all durable events. Phase 5 moved that lifecycle, the relay, retention, and the extraction-ready handlers into `apps/processor`; the API no longer executes durable consumers. Shared transport interfaces, Redis adapters, and outbox components now live in `packages/eventing`. Each consumer owns its inbox identity and event type; `PostgresEventTransaction` records inbox progress and invokes the consumer body in one transaction, followed by optional post-commit effects. Both `tournament.created` and `syncstart.song-completed` use this path without event-specific branching in the consumer loop. Phase 6 moved SyncStart protocol, connector, reconnection, and lobby-session ownership into `apps/syncstart`. Phase 7 moved all inbound browser WebSockets, Pub/Sub fan-out, replaceable gateway snapshots, and connection state into `apps/realtime`; the API contains no gateway or live-subscriber bridge.

### SyncStart

- Owns the SyncStart protocol and all persistent outbound WebSocket connections.
- Owns reconnection, lobby sessions, connector ownership, and protocol parsing.
- Consumes durable SyncStart commands from Redis Streams.
- Publishes critical SyncStart outcomes to Redis Streams.
- Publishes replaceable high-frequency telemetry to Redis Pub/Sub.
- Does not contain frontend DTOs, UI routing, bracket logic, or persistence orchestration.
- Uses the dedicated `tournament-manager.syncstart.commands` Stream and `tournament-manager-syncstart` consumer group by default. API command outcomes and protocol telemetry share the live channel; completed songs also enter the main durable application Stream.
- Stores only desired connector configuration and lobby reconnection specifications in Redis so process restarts can reconstruct volatile connections. PostgreSQL remains authoritative for tournament and result data.

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

### Proposed Eventing Port Decomposition — Pending Review

Status: proposal only. This decomposition is scheduled for user review and must not be implemented until explicitly approved.

The proposed design replaces broad event-transport dependencies at application call sites with four narrow, composition-based ports:

```text
DurableEventPublisher
DurableEventConsumer
RealTimeEventPublisher
RealTimeEventSubscriber
```

Application services would receive only the capability they use through dependency injection. They must not inherit from transport base classes, wrap themselves in a common superclass, or depend on a single unrestricted `EventBus`. Redis implementations may share connection lifecycle and low-level protocol utilities internally, while their public ports remain separate.

Proposed responsibilities:

- `DurableEventPublisher` publishes an internal durable envelope to a configured Stream and returns the transport-assigned message ID.
- `DurableEventConsumer` owns common Redis consumer-group mechanics such as group creation, reads, stale-message reclaim, acknowledgment, transport retry, and graceful shutdown.
- `RealTimeEventPublisher` publishes replaceable live envelopes to a configured Pub/Sub channel.
- `RealTimeEventSubscriber` manages Pub/Sub subscription lifecycle and dispatches received live envelopes to a supplied listener.

The durable consumer abstraction must separate transport mechanics from application processing policy. The shared Redis consumer must not impose one persistence or idempotency model on every service:

```text
Shared durable transport lifecycle
  -> Processor policy: PostgreSQL Inbox + business transaction + bounded retry/dead letter
  -> SyncStart policy: Redis command idempotency + external connector effect handling
```

Durable production must preserve the distinction between database-originated and externally originated events:

```text
Database transaction
  -> OutboxEventProducer
  -> PostgreSQL outbox
  -> Outbox relay
  -> DurableEventPublisher
  -> Redis Stream

External outcome or service command
  -> DurableEventPublisher
  -> Redis Stream
```

`OutboxEventProducer` remains a separate transactional boundary and must not be replaced with direct Redis publication. The outbox relay may use `DurableEventPublisher`, but application code performing a PostgreSQL domain transaction must continue writing the domain change and outbox row atomically.

If approved, the expected package organization is:

```text
packages/eventing/
  durable/
    durable-event-publisher
    durable-event-consumer
    redis-durable-event-publisher
    redis-durable-event-consumer
  realtime/
    realtime-event-publisher
    realtime-event-subscriber
    redis-realtime-event-publisher
    redis-realtime-event-subscriber
  outbox/
    outbox-event-producer
    outbox-relay
  redis/
    redis-client-lifecycle
```

Review questions before approval:

- Whether the consumer port should represent only a single read/reclaim/ack operation or own the complete long-running loop.
- Whether publisher destination names belong in each call or in injected per-service configuration.
- Whether Redis publisher and subscriber implementations should share one internal client-lifecycle component or retain independently owned clients.
- Whether existing retry and dead-letter operations remain part of the durable consumer transport port or become an explicit processing-policy collaborator.
- The incremental migration order from the current combined `RedisEventTransport` without changing behavior.

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

Commands and events are internal current-version contracts and must not expose database entities. Producer and consumer are deployed together; the application does not support incremental message-contract versions or processing messages created by an older application release. Every durable envelope contains only:

```text
id
type
aggregateId
payload
```

The Redis adapter validates only that this minimal envelope can be routed and deduplicated. Payload-specific runtime validation is not repeated for messages produced by application-owned code; TypeScript contracts and producer-consumer tests protect that boundary. External inputs such as SyncStart protocol messages remain validated and normalized before an internal event is created.

An incompatible application update must deliberately abandon old Stream entries, pending consumer-group work, retries, and dead letters, and delete unpublished outbox rows rather than attempting compatibility. A new consumer group starts at the current Stream tail, so it never replays retained messages from an older release. This coordinated clean-cut deployment policy is valid while the application remains pre-production. Before production, deployment and data-preservation requirements must be reviewed explicitly.

UI realtime events additionally include the relevant tournament scope and a sequence number when ordered incremental delivery is required.

The Redis live transport assigns that sequence atomically per tournament before publication. Realtime replicas therefore observe the same sequence and can expose missed-message gaps consistently. Compatibility WebSocket paths receive no-payload sequence markers for unrelated event kinds in the same tournament, preserving gap detection without cross-path or cross-tournament leakage.

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
- Query placement follows behavior ownership and readability; a separate persistence class is not required solely to contain queries. Code running inside an explicit transaction obtains repositories from that transaction's `EntityManager`. Dedicated infrastructure components remain appropriate for shared or specialized concerns such as the PostgreSQL advisory lock's session semantics.
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

1. Standardize persistence on PostgreSQL, remove SQLite and MariaDB support, and define internal contracts and versioned database migrations.
2. Add Redis and provider-independent eventing interfaces to the local stack.
3. Implement outbox, relay, inbox, Redis Streams, retries, and dead-letter handling inside the existing backend.
4. Convert observer-driven domain behavior into stateless handlers without changing deployment boundaries.
5. Extract shared application use cases needed by API and processor entrypoints.
6. Extract the processor application.
7. Extract the SyncStart service and move connector ownership out of the API.
8. Extract the UI Realtime service and add snapshot-based reconnect behavior.
9. Deploy and scale services independently only after behavior is verified at each boundary.

Avoid a big-bang rewrite. Each migration step must preserve existing behavior and leave the repository buildable and testable.
