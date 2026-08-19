# Migration Execution Status

## Current Position

- Last updated: 2026-08-19.
- Completed plan: [Simplified Architecture Migration Plan](MigrationPlan.md).
- State: Migration complete.
- Current runtime: API, migrations, local fixtures, SyncStart, Realtime, frontend, PostgreSQL, and Redis run without processor or durable-event infrastructure.
- Next action: none; future work follows the normal product backlog and the deferred questions in [FunctionalQuestions.md](FunctionalQuestions.md).

## Completed Checkpoints

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
