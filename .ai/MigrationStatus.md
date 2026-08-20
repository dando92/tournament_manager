# Migration Execution Status

## Current Position

- Last updated: 2026-08-20.
- Completed plan: [Simplified Architecture Migration Plan](MigrationPlan.md).
- State: Migration complete.
- Current runtime: API, migrations, local fixtures, SyncStart, Realtime, frontend, PostgreSQL, and Redis run without processor or durable-event infrastructure.
- Next action: none; future work follows the normal product backlog and the deferred questions in [FunctionalQuestions.md](FunctionalQuestions.md).

## Completed Checkpoints

### Authentication unification and administrator bootstrap

- Resolved FQ-004. Removed the synthetic `local-admin` identity, which was not a database row and made `TournamentService.getMyRoles` fail with a PostgreSQL uuid cast error; the frontend permission context swallowed that failure and hid every tournament editing control.
- Replaced API-key authentication with a seeded administrator account. `apps/migrations` now seeds an account from `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD` after applying migrations, creating it only when no account with that username exists. Local runs read the repository-root `.env`; deployed runs read deployment secrets.
- Removed `AuthService.loginWithApiKey`, `POST /auth/login/local`, `LocalApiKeyLoginDto`, both `local-admin` branches, and the `AUTH_MODE` registration gate. `POST /auth/login` is the only authentication path in every environment.
- Removed the unreferenced `Role` enum, `RolesGuard`, and `Roles` decorator. Authorization keeps the two models actually in use: global `isAdmin`/`isTournamentCreator` account flags and per-tournament `Participant.roles`.
- Removed the frontend `isLocalMode` deployment switch, the `authMode` runtime-config field, `VITE_AUTH_MODE`, `PUBLIC_AUTH_MODE`, and the split `local`/`web` start and build scripts.
- Fixed `AuthService.validateUser`, which dereferenced a missing account and returned HTTP 500 instead of 401 for an unknown username.
- Verification passed: architecture check, all workspace builds, lint (pre-existing warnings only, no errors), and all workspace unit suites including a new regression test for unknown-username login.

### API feature-first directory organization

- Split the former all-purpose tournament controller into focused tournament lifecycle, participant management, lobby control, and Start.gg import controllers without changing public routes.
- Replaced the aggregate controller and service barrels with explicit `TournamentModule` composition, keeping the existing manager names and application behavior unchanged.
- Grouped division, phase, phase-group, and advancement-rule code under `tournament/structure`; grouped match, bracket, standing, score, round, song, and completed-song code under `tournament/competition`; and co-located the SyncStart port, HTTP adapter, module, bootstrap, service, and lobby controller under `tournament/syncstart`.
- Mirrored the capability structure under unit tests and separated API e2e and integration suites into dedicated directories.
- Focused verification passed: API build; 11 unit suites with 34 tests; 4 e2e suites with 11 tests; one integration suite with 2 tests; and API lint with the nine pre-existing warnings and no errors.

### API-to-SyncStart client boundary refinement

- Replaced the stateless `LobbyManager` transport bridge with a transport-neutral `SyncStartClient` port, module-selected `HttpSyncStartClient` adapter, and application-facing `TournamentSyncStartService`.
- Moved route selection, authentication, timeout handling, response decoding, and gateway-error mapping into the HTTP adapter; controllers now invoke the application service and do not know the concrete transport.
- Isolated persisted tournament reconciliation in `TournamentSyncStartBootstrap`, preserving the existing API startup behavior without assigning lobby or connection state to the API.
- Added focused unit coverage for application delegation and normalization, HTTP routing and failure mapping, and startup reconciliation.
- Verification passed with `npm run verify`: architecture boundaries, all workspace builds, lint with pre-existing warnings only, contract tests, all workspace unit tests, 11 API e2e tests, and the migration-runner e2e test.

### Deployment maintenance-window decision

- Recorded that every deployment blocks user access to the complete platform until the new or rolled-back release passes readiness and smoke checks.
- Removed zero-downtime, rolling cross-version compatibility, and live SyncStart connection handoff from the deployment requirements. PostgreSQL and Redis may remain available for migration and recovery while application traffic is blocked.
- Kept the external traffic-blocking mechanism as an operational edge decision because the reverse proxy and tunnel are outside the application contract.

### SyncStart scalable ownership refinement

- Bound each configured tournament to a replica-local `TournamentSyncStartRuntime` containing its protocol client, application observers, and focused lobby catalog; the registry now performs only creation, lookup, replacement, delegation, and shutdown.
- Extracted `SyncStartServerSession` to own server connection status and lobby-search correlation, and moved lobby handshake, identity, pending connection, message interpretation, transition dispatch, and transport lifecycle fully behind `LobbySession`.
- Bound `SyncStartClient` to one `tournamentId`, removed direct mutation of session state, propagated the injected WebSocket factory to every server and lobby connection, and registered the client factory through an explicit NestJS token.
- Kept SyncStart deliberately single-replica while documenting the future horizontal rule: one logical owner per `tournamentId`, with distributed assignment and failover deferred until required.
- Replaced static readiness with a real Redis probe and added focused runtime, catalog, session ownership, factory, lifecycle, and health tests.
- Verification passed: production NestJS module bootstrap and shutdown; full workspace build and lint (existing warnings only); all workspace unit tests; 3 SyncStart protocol suites with 6 tests; 6 SyncStart application suites with 20 tests; and repository architecture-boundary checks.

### Realtime object-ownership refactoring

- Replaced the monolithic `RealtimeGateway` with `RealtimeEventService`, `WebSocketBrowserEventBroadcaster`, `TournamentRealtimeRegistry`, and one focused `TournamentRealtimeState` per observed tournament and replica.
- Kept browser message mapping pure, moved WebSocket lifecycle and scoped connections behind `BrowserEventBroadcaster`, and moved replaceable sequence, snapshot, lobby cleanup, and live-match transitions into their state owner.
- Preserved multi-replica Redis Pub/Sub fan-out without shared state, client affinity, locks, or additional persistence. Optional incoming sequences are resolved without mutating subscribed envelopes.
- Added isolated coverage for mapping, sequencing, snapshot replacement, live-match transitions, lobby cleanup, replica convergence, event routing, WebSocket validation and scoping, initial recovery messages, and lifecycle shutdown.
- Verification passed: full workspace build and lint (existing warnings only), all workspace unit tests, 4 Realtime unit suites with 16 tests, and repository architecture-boundary checks.

### Object-oriented ownership design rule

- Recorded the SyncStart ownership model as the default for new backend development: stateful concepts own their state and transitions, while coordinators own composition and lifecycle coordination.
- Kept ownership as the default class-design model and made scalability a conditional assessment: when an ownership boundary affects required scaling, its scope must support the necessary replication or partitioning without introducing premature distributed coordination.
- Existing components are evaluated for incremental adoption when touched; the rule does not mandate unrelated rewrites or class wrappers around stateless pure functions.

### Backend internal HTTP client standard

- Recorded the approved standard for backend-to-backend HTTP: NestJS `HttpModule`, injected `HttpService`, and `firstValueFrom`; direct global `fetch` calls are not used by application-owned HTTP adapters.

### SyncStart outbound HTTP adapter

- Replaced the direct global `fetch` call in `CompletedSongSubmitter` with injected NestJS `HttpService`; the application module imports `HttpModule` for runtime wiring and the existing unit test now mocks the injectable client.
- Verification passed: `npm run lint --workspace=@tournament-manager/syncstart`, `npm run test --workspace=@tournament-manager/syncstart -- --runInBand` (5 suites, 16 tests), and `npm run build --workspace=@tournament-manager/syncstart`.

### SyncStart application unit-test coverage

- Added isolated unit tests for `TournamentSyncStartRegistry`, `InternalController` delegation, `SyncStartEventsPublisher`, `CompletedSongSubmitter`, and lifecycle cleanup in `LobbyCatalog`; no Nest module test or production-code change was required.
- Verification passed: `npm run lint --workspace=@tournament-manager/syncstart` and `npm run test --workspace=@tournament-manager/syncstart -- --runInBand` (5 suites, 16 tests).

### SyncStart refactoring completion

- Extracted `LobbyStateInterpreter` and `LobbySession` from `SyncStartClient`; normalized state transitions and completion de-duplication are now unit-testable without a WebSocket.
- Added injectable WebSocket and SyncStart-client factories, clean protocol/application/simulator builds, and an architecture guard for simulator isolation.
- Verification passed: `npm run lint --workspace=@tournament-manager/syncstart-protocol`, `npm run build --workspace=@tournament-manager/syncstart-protocol`, `npm run lint --workspace=@tournament-manager/syncstart`, `npm run test --workspace=@tournament-manager/syncstart-protocol -- --runInBand`, `npm run test --workspace=@tournament-manager/syncstart -- --runInBand`, and `npm run check:architecture`.

### SyncStart protocol package and session ownership refinement

- Created `@tournament-manager/syncstart-protocol` and moved the external SyncStart WebSocket connector, transport primitives, protocol types, and deterministic simulator from the SyncStart application into it.
- Replaced the command-switching `SyncStartSessionManager` with `TournamentSyncStartRegistry`, which owns one protocol client per configured tournament and exposes the direct operations used by the internal controller.
- Extracted `LobbyCatalog` as the volatile projection of observed lobby metadata. It is updated through protocol events and merges local metadata with remote lobby-search results without owning connections.
- Updated the SyncStart image build order, workspace metadata, architecture documentation, and protocol unit-test ownership.
- Verification passed: `npm run build --workspace=@tournament-manager/contracts`, `npm run build --workspace=@tournament-manager/syncstart-protocol`, `npm run build --workspace=@tournament-manager/syncstart`, `npm run test --workspace=@tournament-manager/syncstart-protocol`, and `npm run lint --workspace=@tournament-manager/syncstart`.

### Scoring package boundary cleanup

- Renamed the generic `@tournament-manager/application` workspace to `@tournament-manager/scoring` and split its former barrel implementation into focused scoring interfaces, calculators, identifier types, and provider files.
- Made `ScoringSystemType` and `SCORING_SYSTEM_TYPES` the canonical scoring identifiers. Persistence entity fields and API DTOs now use the type, while request validation and OpenAPI metadata use the runtime identifier list.
- Kept bracket implementations and `BracketSystemProvider` inside the API because they directly orchestrate API services and persistence. The currently selected bracket type remains persisted on each phase group and is consumed by API and frontend behavior.
- Updated workspace dependency rules, Docker builds, and architecture documentation for the new package boundary.
- Verification passed: `npm run build`, `npm run lint` (existing warnings only), `npm test --workspace=@tournament-manager/api -- --runInBand` (8 suites, 26 tests), `npm run check:architecture`, and a clean build of `apps/migrations/Dockerfile`.

### Phase 0 complete

- Replaced the superseded target architecture, backend rules, migration plan, and functional-question framing with the approved simplified architecture and explicit reliability tradeoffs.
- Rebased the behavior inventory on the current extracted API, SyncStart, Realtime, processor, and Redis transport runtime; it identifies the existing protocol, completed-song, realtime-routing, match/advancement, standings, and Start.gg coverage that protects later phases.
- Updated the repository overview to distinguish transitional processor/eventing workspaces from target migration, local-fixtures, live-messaging, and Start.gg workspaces.
- No additional characterization test was required: focused unit, protocol, realtime, and PostgreSQL/Redis e2e suites already cover the behavior later simplifications will move.

### Phase 1 complete

- Created the independent `apps/migrations` workspace, Docker image, runner, scripts, and migration-runner e2e test. API test helpers now use the extracted migration source.
- Created `apps/local-fixtures` as a one-shot Nest application. It creates the deterministic tournament idempotently, supports an optional `LOCAL_FIXTURE_SYNCSTART_URL`, and is run only by local Compose after migrations and SyncStart are ready.
- Made the bundled SyncStart simulator optional through the `simulator` Compose profile; a fixture can instead use a configured host or remote WebSocket URL.
- Created `@tournament-manager/startgg` and moved its GraphQL client, operations, provider types, parsing, pagination, rate limiting, and response mapping out of the API. API orchestration and HTTP DTOs remain in place.
- Removed `AppLogger` and `PostgresTournamentPersistence`; `TournamentService` now owns its creation transaction directly.
- Added the migrations image to continuous delivery and updated workspace, Docker, runtime configuration, architecture checks, and local-operation documentation.

### Phases 2 through 5 review

- API-to-SyncStart commands and SyncStart-to-API completed songs use authenticated internal HTTP.
- Redis Pub/Sub carries replaceable live messages through `@tournament-manager/live-messaging`; processor, Streams, outbox, inbox, retries, dead letters, and retention code were removed.
- Deployment topology, CI matrix, local checks, and service images no longer include the processor.
- Final code parity verification passed for API unit tests, contract tests, PostgreSQL/Redis e2e tests, workspace builds, and architecture boundaries. Existing lint warnings remain non-blocking.

### Migration closure complete

- Fixed missing workspace build dependencies in the API and local-fixtures images and enabled Nest dependency-injection metadata in `@tournament-manager/live-messaging`.
- Made repository and local verification build shared workspaces before running tests, and aligned the affected e2e tests with the synchronous SyncStart and lazy Redis publisher lifecycles.
- Consolidated the pre-production database history into one application-only baseline; eventing migrations, tables, indexes, and the obsolete `transportPurgedAt` field were removed.
- Removed stale processor, Streams, outbox, inbox, retry, dead-letter, and retention procedures from local operations documentation.
- Passed clean-stack verification and a second complete verification after restarting with PostgreSQL and Redis volumes retained.

### Live messaging boundary refinement

- Moved generic event envelopes and their validation from `@tournament-manager/contracts` into `@tournament-manager/live-messaging`. Contracts now contain only SyncStart DTOs and internal HTTP request contracts.
- Defined `EventEnvelope`, `IdentifiedEventEnvelope`, and `SequencedLiveEventEnvelope` around the shared tournament scope; completed-song processing uses the identified variant for idempotency.
- Organized Redis adapters under `transports/redis` and added `InMemoryLiveEventTransport`, which implements both publisher and subscriber ports for Redis-free tests.
- Updated application imports, package dependencies, architecture documentation, and envelope/in-memory transport tests.
- Verification passed: builds and type lint for contracts, live-messaging, API, SyncStart, and Realtime; `npm run test:contract`; and `npm run test:unit` (all workspace unit suites passed). API lint completed with its nine pre-existing warnings and no errors.

## Verification

```text
npm run verify
PASS: architecture boundaries, all workspace builds, lint (warnings only), contracts, unit tests, API e2e tests, and migration-runner e2e test

npm run local:reset
PASS: all images build; migrations and fixtures complete; API, SyncStart, both Realtime replicas, frontend, PostgreSQL, and Redis become healthy

Database baseline inspection
PASS: only InitialSchema1787085404083 is recorded; event_outbox and event_inbox are absent; Local E2E Tournament has id 1

npm run verify:local
PASS: workspace build, PostgreSQL/Redis integration tests, 11 API e2e tests, migration-runner e2e test, all health/readiness endpoints, Swagger, deterministic fixture, and frontend

npm run local:down
docker compose up --detach --wait --remove-orphans
PASS: stack restarts with named volumes retained; migration record and fixture remain unchanged

npm run verify:local
PASS: complete local verification after retained-volume restart
```

## Handoff Rule

After each coherent checkpoint, record the completed scope, exact verification commands and results, and the next concrete action. Functional ambiguities belong in [FunctionalQuestions.md](FunctionalQuestions.md).
