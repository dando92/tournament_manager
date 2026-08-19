# Migration Execution Status

## Current Position

- Last updated: 2026-08-19.
- Active plan: [Simplified Architecture Migration Plan](MigrationPlan.md).
- State: Phase 1 complete.
- Current runtime: migrations, local fixtures, and Start.gg provider code are independently owned; the transitional durable-event architecture remains until its replacement in Phases 2 through 4.
- Next action: Phase 2 — replace Redis command/event flows with authenticated internal HTTP.

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

## Verification

```text
npm run verify
PASS: architecture-boundary check
PASS: workspace TypeScript and ESLint checks (10 pre-existing API lint warnings; no errors)
PASS: contracts, unit, PostgreSQL/Redis e2e, and workspace build stages

npm run test --workspace=@tournament-manager/api -- --runInBand
PASS: 8 suites, 26 tests

npm run test:e2e --workspace=@tournament-manager/api -- --runInBand
PASS: 5 suites, 19 tests

npm run test:e2e --workspace=@tournament-manager/migrations
PASS: 1 suite, 1 test

npm run build
PASS: all workspaces build

npm run check:architecture
PASS: architecture boundaries verified

docker compose build migrations local-fixtures
PASS: both images compile; a concurrent local Compose build reported a non-code tag-export conflict for the already-created local-fixtures image.
```

## Handoff Rule

After each coherent checkpoint, record the completed scope, exact verification commands and results, and the next concrete action. Functional ambiguities belong in [FunctionalQuestions.md](FunctionalQuestions.md).
