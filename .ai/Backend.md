# Backend Architecture and Coding Rules

## NestJS Architecture

The backend uses the following architectural layers:

- **Controllers:** Define API routes and contain almost no application logic. Controllers encapsulate and delegate to services or managers. They must not access or inject repositories.
- **Controller routes:** Route inputs must be mapped through DTOs instead of individual native parameters. A native parameter is allowed only when the route accepts a single value, such as `id: number`.
- **Managers:** Implement application logic and complex orchestration. Managers must not access or inject repositories. They use the appropriate services whenever they need to retrieve or update database data. Managers also transform database entities into DTOs for the view.
- **Services:** Provide CRUD access to the database. Services encapsulate repositories and all database access, and return plain database entities that managers decouple from the presentation layer.
- **Entities:** Represent database entities.
- **Gateways:** Provide real-time view updates through WebSockets.
- **DTOs:** Define data exchanged with the view, both incoming and outgoing.

## Maintainability

- Prefer the smallest explicit implementation that satisfies the current requirement.
- Ask the user before introducing substantial architectural or concurrency complexity. Do not add speculative protection for rare manual-operation races.
- Keep classes, functions, fixtures, and test helpers focused and locally understandable.
- Split long handlers and functions into small operations with semantically meaningful names so the orchestration reads as a clear sequence of steps.
- Use descriptive names and straightforward control flow instead of implicit conventions or premature generic abstractions.
- Extract shared code only when it removes real duplication or establishes an approved architectural boundary.
- Keep characterization tests readable as behavior documentation for future maintainers.
- Do not mix architectural migration with unrelated cleanup or functional changes.
- Use configured `@` aliases for imports across directories, applications, and packages. Do not use relative path traversal for project modules.

## Technologies

- Node.js 22
- TypeScript
- NestJS 11
- TypeORM
- PostgreSQL-compatible persistence
- Redis Streams for durable event transport
- Redis Pub/Sub for replaceable live events
- PostgreSQL is the only supported database in the target architecture.
- SQLite and MariaDB configuration, dependencies, adapters, and migration paths are not supported.
- TypeORM schema synchronization is disabled in every environment. Versioned PostgreSQL migrations are the only application-schema mechanism.
- The initial migration targets an empty pre-production database. Existing test databases are reset instead of carrying compatibility code into the baseline.
- Native WebSockets through NestJS gateways

## Location and Integrations

The current backend is located in `apps/backend` and is the source of the service extraction defined in `Architecture.md`. Its current module boundaries must not be treated as final deployment boundaries.

Local configuration is loaded from the repository-root `.env` file. The `local` configuration must start the complete application and its PostgreSQL and Redis dependencies through Docker Compose without requiring cloud services. Local startup requirements are defined in [Architecture.md](Architecture.md).

## Health and Local Bootstrap

- `GET /health/live` reports process liveness and must not depend on external services.
- `GET /health/ready` reports PostgreSQL, Redis, and migration-runner readiness separately and returns HTTP `503` while any required dependency is unavailable.
- Docker Compose runs the migration entrypoint to completion before starting the backend.
- The migration runner applies versioned application-schema migrations before backend startup, and readiness remains unavailable if it does not complete.
- Optional local seed data must be deterministic and idempotent. It is enabled only through `LOCAL_SEED_ENABLED=true`.
- Operational procedures are defined in [LocalOperations.md](LocalOperations.md).

## Target Backend Boundaries

The approved target separates API, stateless event processing, SyncStart connections, and UI realtime delivery. Detailed ownership, event flows, reliability rules, and migration order are defined in [Architecture.md](Architecture.md).

Managers remain application-layer use cases. Event handlers should invoke shared managers or services when the behavior is reused. A processor-only transactional handler may use repositories from its supplied transaction `EntityManager`; it does not need a separate persistence class merely to contain queries. Keep the orchestration explicit and split long flows into focused, semantically named methods.

## Database Access and Transactions

- Queries belong with the code that owns and explains the behavior. A dedicated persistence class is optional and must be justified by reuse, a replaceable interface, or substantial infrastructure-specific behavior; it is not required simply to separate queries from a handler or use case.
- Within an explicit transaction, obtain every participating repository from the supplied transaction `EntityManager`. Do not use an injected repository inside that transaction because it may use a different connection.
- Direct SQL is allowed where PostgreSQL capabilities or required query semantics are not expressed adequately by TypeORM. Keep it localized in a clearly named method or infrastructure component.
- Prefer readable orchestration over extra classes: decompose a long transactional flow into small semantic methods before introducing another layer.
- PostgreSQL advisory-lock SQL and session acquisition/release behavior are centralized in a dedicated `PostgresAdvisoryLock` infrastructure class. This class may depend on TypeORM session primitives; application code must not depend on it directly.
- Do not present PostgreSQL advisory locks as a generic distributed-lock abstraction. PostgreSQL is an approved explicit infrastructure dependency, while provider independence means independence from a particular cloud provider rather than database-engine portability.
- Do not require every ordinary tournament mutation to open a transaction and lock the tournament row. Mutations check the lifecycle state at entry; the rare race in which a mutation overlaps manual closure is accepted during pre-production to avoid spreading locking complexity across all write paths. Revisit this tradeoff before production only if the stronger invariant is required.
- Use one global advisory lock to elect a single retention sweep across service replicas. Do not coordinate retention with manual close or reopen operations through locks or repeated eligibility checks.

## Eventing Inside the Existing Backend

- Durable contracts are explicit internal envelopes in `packages/contracts`. They contain only event ID, type, aggregate ID, and payload, and never expose TypeORM entities.
- PostgreSQL `event_outbox` rows are written in the same transaction as their domain change. Publishing directly to Redis from a domain transaction is not allowed.
- The relay publishes durable events to the configured Redis Stream and marks outbox rows only after Redis acknowledges `XADD`. A crash between those operations may duplicate delivery, so consumers must remain idempotent.
- Durable consumers use Redis consumer groups and insert an `event_inbox` row in the same PostgreSQL transaction as their business effect. Inbox identity is the stable handler name plus event ID.
- Failed events remain pending for another consumer to reclaim. Retry count is bounded; exhausted events are acknowledged only after being copied to the `.dead-letter` stream with the reason, attempt count, and failure time.
- Replaceable live events use the separate Pub/Sub adapter. Subscribers must recover missed messages from a newer update or authoritative HTTP snapshot.
- `EVENT_STREAM`, `EVENT_CONSUMER_GROUP`, and `LIVE_EVENT_CHANNEL` configure provider-independent Redis destinations. Their defaults are suitable for the local stack.

The first migrated Phase 3 slice is `tournament.created`. Tournament creation and its outbox record commit atomically; the processor consumer creates the idempotent `tournament_event_projection` and publishes a replaceable `tournament.snapshot-changed` live event. Existing synchronous controller and SyncStart behavior remains in place.

Tournament-scoped events always use the tournament ID as their aggregate ID. The Redis adapter atomically indexes Stream and dead-letter entry IDs by aggregate so retention never scans a complete Stream. A closed tournament rejects mutating HTTP use cases with `409 Conflict`; reads and the explicit reopen operation remain available.

`EventRetentionService` runs only inside the processor with the other eventing workers. It purges all transport data after the configured continuously-closed period, including unpublished outbox rows and dead letters. Database deletion is batched, Redis pending entries are acknowledged before deletion, and one global advisory lock prevents concurrent sweeps across replicas. Retention deliberately does not lock against or recheck rare concurrent manual lifecycle operations. `PostgresEventRetentionPersistence` owns the retention SQL and `PostgresAdvisoryLock` owns the session-scoped global lock mechanics.

## Extracted Processor Boundary

- `apps/processor` owns the outbox relay, durable Redis Streams consumer loop, inbox transaction lifecycle, retry/dead-letter behavior, retention sweep, and registered stateless handlers.
- The API owns durable producers and the temporary Pub/Sub-to-WebSocket forwarding bridge, but it does not execute durable handlers or relay outbox work.
- `packages/application` contains reusable scoring calculations used from both synchronous API paths and processor handlers.
- `packages/contracts` contains the shared internal message types.
- `packages/eventing` contains the transport interfaces, Redis adapter, outbox service, and PostgreSQL outbox adapter shared by API producers and processor workers.
- API and processor use independent entrypoints, images, health checks, and logs. Processor health is internal to the Compose network so multiple replicas can run without host-port conflicts.

## Stateless Handler Registration

- `EventConsumerRegistry` registers one current consumer per event type without coupling the eventing runner to tournament modules.
- Every `EventConsumer` owns its stable inbox `identity`, event type, transactional `handle`, and optional post-commit effect. `PostgresEventTransaction` performs the standard inbox insertion and invokes the concrete handler inside the same transaction; duplicate events never enter the handler body.
- `tournament.created` uses the same registry and transaction path as every other durable event. The event loop contains no event-specific branches.
- The Phase 4 `syncstart.song-completed` producer publishes the normalized external SyncStart outcome directly to Redis Streams. It does not use the PostgreSQL outbox because the outcome does not originate in a PostgreSQL transaction.
- `LobbySongCompletedHandler` is stateless. The common event transaction records the inbox entry, then the handler applies its processor-only score and standing orchestration through focused, semantically named methods using repositories from the supplied transaction `EntityManager`. Query separation into a dedicated class is not required. Match invalidations and best-effort warnings run only after commit. Match state is recoverable from the authoritative HTTP snapshot; warnings preserve the existing ephemeral notification behavior.
- `PostgresTournamentPersistence` owns the tournament-creation transaction and obtains the tournament repository from its transaction `EntityManager`; it writes the `tournament.created` outbox event through the focused outbox adapter in that same transaction.
- A failed Redis publication is retryable from the next SyncStart lobby-state update because the connector records its completion signature only after all observers accept the event.
- Synchronous HTTP use cases in `MatchWorkflowManager` and `AdvancementManager` remain synchronous and stateless. Start.gg reporting remains on that request/response path.
- Internal Redis payloads are trusted after minimal envelope parsing. Incompatible deployments discard retained transport work instead of supporting old message shapes.
