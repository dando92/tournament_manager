# Backend Architecture and Coding Rules

## General Rules

- Keep implementations as simple as reasonably possible for approved requirements.
- Keep API managers and services stateless; PostgreSQL owns authoritative application state.
- Connection adapters may own volatile connection and correlation state.
- Do not introduce durable messaging, distributed locks, or asynchronous workflows without an explicit requirement.
- Keep controllers thin and application orchestration explicit.
- Use configured `@` aliases for project imports.
- Keep application and protocol logic unit-testable without Redis, HTTP servers, or WebSockets by injecting transport ports.

## Technologies

- NestJS and TypeScript for API, SyncStart, Realtime, migrations, and local fixtures.
- TypeORM and PostgreSQL for authoritative persistence.
- Redis Pub/Sub for replaceable live-message fan-out only.
- Native WebSockets for the external SyncStart protocol and browser Realtime connections.
- Internal HTTP for API/SyncStart request-response communication and snapshots.

Redis Streams, transactional outbox, consumer inbox, processor workers, retries, dead letters, and transport retention are not part of the approved target.

## Application Boundaries

- API owns synchronous HTTP use cases, database transactions, and Start.gg application orchestration.
- SyncStart owns protocol connections, connectors, lobby sessions, and volatile live state.
- Realtime owns browser WebSockets and scoped fan-out.
- Migrations own schema rollout as a one-shot application.
- Local fixtures own optional local-only deterministic data.

`@tournament-manager/scoring` owns scoring-system identifiers, pure calculations, and the scoring provider registry. Persistence may depend on those domain identifiers for entity field types; scoring must remain independent of TypeORM and application services. Bracket implementations remain API-owned because they orchestrate API services and persistence operations rather than providing pure shared calculations.

Detailed ownership and communication flows are defined in [Architecture.md](Architecture.md).

## Database Access and Transactions

- Use `DataSource.transaction()` directly in the service that owns a multi-write invariant.
- Obtain every repository used inside a transaction from its `EntityManager`.
- Do not create a persistence class solely to wrap one transaction or move a query out of a service.
- Direct SQL is allowed when PostgreSQL-specific behavior is clearer than a TypeORM equivalent; keep it localized and named.
- TypeORM schema synchronization is disabled in every environment.
- Versioned PostgreSQL migrations are the only schema mechanism.
- The current pre-production database is disposable and may be reset to a clean baseline.

`PostgresTournamentPersistence` is superseded. Tournament creation and its required transaction belong directly in `TournamentService`.

## Live Messages

- API and SyncStart depend on `LiveEventPublisher`, implemented by a Redis Pub/Sub adapter.
- Realtime depends on `LiveEventSubscriber` and `BrowserEventBroadcaster`.
- Realtime maps and forwards messages but performs no domain queries or calculations.
- Publishers must provide the tournament scope and complete payload needed for routing.
- Subscribers recover missed persisted state through API HTTP snapshots.
- Volatile live state is recovered from SyncStart snapshots where supported.
- Do not model replaceable GUI invalidations as durable outbox events.

`@tournament-manager/contracts` owns transport-neutral DTOs and live envelopes. `@tournament-manager/live-messaging` owns only publisher/subscriber ports and Redis Pub/Sub adapters. HTTP and WebSocket adapters remain application-local.

## SyncStart Communication

- API sends connection and lobby commands through authenticated internal HTTP endpoints.
- SyncStart sends normalized completed songs to an authenticated idempotent API endpoint.
- The API applies score, standing, match, and advancement behavior synchronously.
- Completed-song delivery is best effort. Manual score entry is the approved recovery for an occasional loss.
- SyncStart may use simple bounded in-memory retry, but must not add a persistent queue without approval.
- SyncStart protocol dispatch uses focused `LobbyLifecycleObserver`, `LiveMatchObserver`, and `CompletedSongObserver` interfaces. Avoid one observer containing many optional callbacks.
- API-to-SyncStart code depends on `SyncStartClient`; completed-song propagation depends on `CompletedSongSink`. Unit tests use fakes or spies.

## Start.gg

- `@tournament-manager/startgg` owns provider protocol details only: GraphQL client, operations, types, parsing, pagination, rate limiting, and normalized provider errors.
- API owns authorization, HTTP DTOs, import/report orchestration, database writes, mappings, and UI invalidation.
- Reporting remains synchronous during this migration.

## Health and Bootstrap

- `GET /health/live` reports process liveness without external dependencies.
- `GET /health/ready` reports required runtime dependencies and returns `503` when unavailable.
- The migration application must complete before dependent services start; runtime health does not compare migration manifests.
- Optional local fixtures are deterministic and idempotent.
- `LOCAL_FIXTURE_SYNCSTART_URL` optionally configures a simulator, host, or remote SyncStart server.

## Logging

- Use the standard NestJS logger and write container logs to stdout/stderr.
- Do not maintain a custom file logger unless a future explicit operational requirement justifies one.
