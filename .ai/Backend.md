# Backend Architecture and Coding Rules

## General Rules

- Keep implementations as simple as reasonably possible for approved requirements.
- Keep API managers and services stateless; PostgreSQL owns authoritative application state.
- Connection adapters may own volatile connection and correlation state.
- Do not introduce durable messaging, distributed locks, or asynchronous workflows without an explicit requirement.
- Keep controllers thin and application orchestration explicit.
- Use configured `@` aliases for project imports.
- Keep application and protocol logic unit-testable without Redis, HTTP servers, or WebSockets by injecting transport ports. Application-owned outbound HTTP adapters use NestJS `HttpService` rather than direct global `fetch` calls.

## Object-Oriented Ownership

- Model a domain or integration concept that has state or a lifecycle as an object that owns both that state and the valid transitions that change it.
- For every stateful owner, define its ownership key and lifetime, whether its state is authoritative or reconstructible, and whether it is replica-local, replicated, or exclusive to one logical owner.
- Keep coordinators focused on object creation, lookup, composition, routing, and shutdown. A coordinator must not interpret or mutate another object's internal state.
- Place protocol interpretation and state-transition detection in focused stateful objects. Keep transport lifecycle, event dispatch, and application side effects behind separate responsibilities and narrow interfaces.
- Inject infrastructure dependencies and factories so each object's behavior can be tested without starting its real transport or service.
- External resources with an exclusive lifecycle, including protocol WebSockets, must have one logical owner. Scale them by partitioning their ownership key rather than duplicating the resource across replicas.
- Keep replica-local registries explicitly local and make exclusive owners reconstructible from authoritative configuration. Do not add leases, distributed routing, or ownership coordination until multi-replica operation is an approved requirement.
- Scalability requirements apply to steady-state workload and unplanned process failure. Planned deployments run with the platform blocked, so do not add cross-version compatibility, rolling handoff, or zero-downtime lifecycle complexity for deployment continuity.
- Do not introduce classes around stateless calculations solely to appear object-oriented; pure functions remain appropriate when there is no identity, owned state, or lifecycle.
- Apply this ownership model by default to new development. When changing an existing component, assess whether its state and transitions can be moved behind clearer ownership boundaries as part of the scoped work. Refactor incrementally when this improves cohesion and testability without introducing unrelated churn or speculative abstractions.

The SyncStart protocol package is the reference implementation: `LobbyConnection` owns transport lifecycle, `LobbyStateInterpreter` owns snapshot-transition memory, `LobbySession` owns one lobby, `SyncStartServerSession` owns server connection and request correlation, and `SyncStartClient` coordinates those stateful objects. The application binds them to a `TournamentSyncStartRuntime` whose ownership key is `tournamentId`.

## Technologies

- NestJS and TypeScript for API, SyncStart, Realtime, migrations, and local fixtures.
- TypeORM and PostgreSQL for authoritative persistence.
- Redis Pub/Sub for replaceable live-message fan-out only.
- Native WebSockets for the external SyncStart protocol and browser Realtime connections.
- Internal HTTP for API/SyncStart request-response communication and snapshots. Backend-to-backend HTTP calls use `@nestjs/axios` (`HttpModule` and injected `HttpService`) with `firstValueFrom`; the HTTP client must be mocked through dependency injection in unit tests.

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
- `RealtimeEventService` owns subscription lifecycle and routing only. `WebSocketBrowserEventBroadcaster` owns the browser WebSocket server and scoped client connections.
- Each replica-local `TournamentRealtimeState` owns one tournament's replaceable sequence, snapshots, and live-match transitions. `TournamentRealtimeRegistry` creates and locates those independent projections; none of this state is authoritative or shared between replicas.
- The realtime event mapper remains a pure function. The state owner resolves an optional incoming sequence without mutating the subscribed envelope.
- Publishers must provide the tournament scope and complete payload needed for routing.
- Subscribers recover missed persisted state through API HTTP snapshots.
- Volatile live state is recovered from SyncStart snapshots where supported.
- Do not model replaceable GUI invalidations as durable outbox events.

`@tournament-manager/contracts` owns transport-neutral SyncStart DTOs and internal HTTP request contracts. `@tournament-manager/live-messaging` owns generic event envelopes, envelope validation, publisher/subscriber ports, NestJS tokens, and Redis or in-memory transports. `@tournament-manager/syncstart-protocol` owns the external SyncStart WebSocket adapter and deterministic simulator. HTTP adapters remain application-local.

## SyncStart Communication

- API sends connection and lobby commands through authenticated internal HTTP endpoints.
- SyncStart sends normalized completed songs to an authenticated idempotent API endpoint.
- The API applies score, standing, match, and advancement behavior synchronously.
- Completed-song delivery is best effort. Manual score entry is the approved recovery for an occasional loss.
- SyncStart may use simple bounded in-memory retry, but must not add a persistent queue without approval.
- The SyncStart application maps tournaments to independent protocol clients through `TournamentSyncStartRegistry`. `LobbyCatalog` is a volatile query projection updated by protocol events; it does not own connections or communicate with SyncStart.
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
