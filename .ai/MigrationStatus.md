# Migration Execution Status

## Purpose

This is the durable handoff record for migration work. Future contributors and coding agents must read this document together with [MigrationPlan.md](MigrationPlan.md) before making migration changes. Update it after every completed checkpoint so that the repository always states what is done, what was verified, and what should happen next.

Functional ambiguities and suspected behavior defects are tracked separately in [FunctionalQuestions.md](FunctionalQuestions.md). Migration work must link new findings there instead of silently deciding them.

## Current Position

- Last updated: 2026-08-19.
- Active phase: Phase 4 — Stateless Event Handlers (not started).
- Phase 0 state: complete; its exit gate passed on 2026-08-18.
- Phase 1 state: complete; its exit gate passed on 2026-08-18.
- Phase 2 state: complete; its exit gate passed on 2026-08-18.
- Phase 3 state: complete; its exit gate passed on 2026-08-18.
- Service extraction is not authorized yet because the Phase 4 pre-extraction exit gate remains open.
- Next action: refactor lifecycle and eventing persistence behind focused PostgreSQL adapters before adding Phase 4 handlers. Centralize only the global retention-sweep advisory lock in a dedicated infrastructure class and use transaction-owned repositories for atomic work.
- Approved Phase 0 exclusions: no Start.gg integration tests, no SyncStart integration or protocol tests, and no browser WebSocket network tests.

## Completed Checkpoints

### Phase 0 checkpoint 1 — Verification command and first behavioral e2e slice

- Added the repository-root `npm run verify` command.
- Added explicit `npm run test:unit` and root `npm run test:e2e` commands.
- Replaced the generated NestJS placeholder e2e test with a behavioral workflow covering:
  - account registration and password login;
  - JWT authentication and tournament-creation authorization;
  - tournament creation, retrieval, update, and public listing.
- Added deterministic e2e environment configuration and reusable tournament-management fixtures.
- Fixed Jest alias resolution and aligned the e2e bootstrap with the native WebSocket adapter used by the application.
- Recorded the current HTTP, realtime, observer, integration, and critical-journey inventory in [BaselineInventory.md](BaselineInventory.md).
- Updated developer verification documentation.

Verification result:

```text
npm run verify
PASS: backend lint (warnings only)
PASS: 3 unit tests
PASS: 2 behavioral e2e tests
PASS: backend build
PASS: frontend build
```

### Phase 0 checkpoint 2 — Standings characterization

- Added focused unit coverage for Eurocup ranking, ties, failed scores, and point allocation.
- Added focused unit coverage for the current finals scoring behavior.
- Added focused `StandingManager` coverage for incomplete rounds, completed-round recalculation and persistence, score replacement, and workflow editability enforcement.
- Recorded the existing finals failure-handling defect below without changing production behavior.

Verification result:

```text
npm run verify
PASS: backend and frontend lint (warnings only)
PASS: 12 unit tests
PASS: 2 behavioral e2e tests
PASS: backend build
PASS: frontend build
```

### Phase 0 checkpoint 3 — Bracket advancement characterization

- Added focused `AdvancementManager` coverage for match-result placement into configured target slots.
- Characterized duplicate prevention when an entrant is already present in the target match.
- Covered aggregate phase-group placement and completion after all match results exist.
- Covered incomplete phase groups remaining open.
- Covered reversal of match and phase-group advancement, including phase-group reopening.

Verification result:

```text
npm run verify
PASS: backend and frontend lint (warnings only)
PASS: 17 unit tests
PASS: 2 behavioral e2e tests
PASS: backend build
PASS: frontend build
```

### Phase 0 checkpoint 4 — Match workflow characterization

- Added focused `MatchWorkflowManager` coverage for aggregating populated round standings and persisting results.
- Covered rejection of incomplete standings and normalization of manual results.
- Covered recompletion by reverting previous advancement before replacement.
- Covered reopening a match, deleting its result, reverting advancement, and deactivating it.
- Covered the boundary that reports completed matches to Start.gg only after local completion succeeds.
- Covered the constraint that completed matches cannot be activated before reopening.

Verification result:

```text
npm run verify
PASS: backend and frontend lint (warnings only)
PASS: 23 unit tests
PASS: 2 behavioral e2e tests
PASS: backend build
PASS: frontend build
```

### Phase 0 checkpoint 5 — Lobby state characterization and functional-question register

- Added focused `LobbyManager` coverage without opening real network connections.
- Covered connector initialization, lobby-code normalization, discovery metadata merging, failed connections, reconnectable disconnections, inactive lobby removal, and explicit leave behavior.
- Created [FunctionalQuestions.md](FunctionalQuestions.md) as the post-migration functional decision backlog and indexed it from the project instructions.
- Recorded known questions about finals failure handling, lobby identity scope, tournament creation fields, and local administrator ownership.
- Added explicit backend maintainability rules favoring small, readable implementations and tests.

Verification result:

```text
npm run verify
PASS: backend and frontend lint (warnings only)
PASS: 28 unit tests
PASS: 2 behavioral e2e tests
PASS: backend build
PASS: frontend build
```

### Phase 0 checkpoint 6 — Score and match-result persistence characterization

- Added behavioral persistence coverage using an isolated local SQLite database and the real TypeORM services.
- Covered score creation, relation loading, filtering, partial update, and missing-reference rejection.
- Covered match-result creation, replacement without duplication, association with the match, and deletion.
- Aligned the TypeScript optional fields in `UpdateScoreDto` with their existing validation metadata; runtime behavior is unchanged.
- Updated the approved Phase 0 scope to exclude Start.gg, SyncStart integration, and browser WebSocket network tests.

Verification result:

```text
npm run verify
PASS: backend and frontend lint (warnings only)
PASS: 28 unit tests
PASS: 5 behavioral e2e tests
PASS: backend build
PASS: frontend build
```

### Phase 0 checkpoint 7 — Clean-install verification

- Reinstalled the complete workspace dependency tree with `npm ci` from the committed lockfile.
- Increased only the Jest e2e timeout from 5 to 30 seconds so the first cold `ts-jest` compilation is reliable on a clean installation.
- Ran the complete verification command after the clean install.

Verification result:

```text
npm ci
PASS: 1093 packages installed from the lockfile

npm run verify
PASS: backend and frontend lint (warnings only)
PASS: 28 unit tests
PASS: 5 behavioral e2e tests
PASS: backend build
PASS: frontend build
```

### Phase 0 checkpoint 8 — Participant structure workflow and phase completion

- Expanded the behavioral HTTP workflow to create a tournament participant, division, singles entrant, phase, and phase group.
- Covered phase-group entrant assignment and the resulting tournament overview counts.
- Re-ran the complete verification command after the final Phase 0 change.
- Confirmed that the approved Phase 0 exit gate passes with the documented Start.gg, SyncStart, and browser WebSocket exclusions.

Verification result:

```text
npm run verify
PASS: backend and frontend lint (warnings only)
PASS: 28 unit tests
PASS: 6 behavioral e2e tests
PASS: backend build
PASS: frontend build
```

### Phase 1 checkpoint 1 — Reproducible local platform

- Added pinned PostgreSQL 16.4 and Redis 7.4.0 services with named volumes and health checks.
- Added a one-shot migration runner that must complete before the backend starts. It establishes the runner and migration status table; versioned application-schema migrations and disabling TypeORM synchronization remain Phase 2 work.
- Added backend liveness and readiness endpoints. Readiness reports PostgreSQL, Redis, and migration-runner state separately.
- Added deterministic, idempotent local tournament seed data behind explicit local configuration.
- Added the required root lifecycle commands: `local:up`, `local:status`, `local:logs`, `local:down`, and explicit destructive `local:reset`.
- Added PostgreSQL and Redis integration tests plus `verify:local` checks for API liveness/readiness, migrations, Swagger, seed data, and frontend availability.
- Fixed the production container entrypoint so it does not depend on the development-only `cross-env` package and respects container environment configuration.
- Documented startup, status, logs, shutdown, restart, backup, restore, recovery, and reset procedures in [LocalOperations.md](LocalOperations.md).

Verification result:

```text
npm run verify
PASS: backend and frontend lint (warnings only)
PASS: 31 unit tests
PASS: 6 behavioral e2e tests
PASS: backend build
PASS: frontend build

npm run local:up
PASS: fresh PostgreSQL and Redis volumes created
PASS: migration runner completed before backend startup
PASS: PostgreSQL, Redis, backend, and frontend healthy

npm run verify:local
PASS: 2 PostgreSQL and Redis integration tests
PASS: 6 behavioral e2e tests
PASS: API liveness and readiness
PASS: Swagger, deterministic seed, and frontend smoke checks

Operational checks
PASS: backend-only restart
PASS: Redis outage reported independently and readiness recovered after restart
PASS: PostgreSQL outage reported independently and readiness recovered after restart
PASS: complete shutdown and retained-volume restart; deterministic seed retained its identity
```

Known non-blocking output:

- Existing backend and frontend lint warnings remain.
- Vite reports an existing large JavaScript chunk warning.
- `npm ci` reports deprecated transitive packages and 11 dependency vulnerabilities (2 low, 3 moderate, 5 high, and 1 critical). Dependency remediation is deferred to a dedicated reviewed checkpoint; do not apply breaking `npm audit fix --force` changes during migration.

### Phase 2 checkpoint 1 — PostgreSQL-only persistence baseline

- Added the initial versioned PostgreSQL migration for the complete application schema, including UUID support.
- Disabled TypeORM schema synchronization in the application, migration runner, and tests.
- Removed SQLite and MariaDB runtime selection, environment variables, scripts, direct dependencies, and documentation.
- Converted behavioral persistence and application e2e suites to isolated PostgreSQL databases created from migrations.
- Added migration coverage for empty-database creation, repeated-run idempotency, and full entity-schema equivalence.
- Preserved the numeric score API behavior with an explicit PostgreSQL decimal transformer.
- Strengthened platform integration coverage to require an applied migration and application tables.
- Added the PostgreSQL dependency bootstrap command for direct development.
- Recorded the user-approved pre-production policy: existing test data and schemas are disposable, and compatibility migrations or API compatibility layers are not required until production is explicitly declared.

Verification result:

```text
npm run local:reset
PASS: PostgreSQL and Redis volumes recreated from zero
PASS: initial application-schema migration applied before backend startup
PASS: PostgreSQL, Redis, backend, and frontend healthy

npm run verify:local
PASS: 2 PostgreSQL and Redis integration tests
PASS: 8 PostgreSQL-backed behavioral and migration e2e tests
PASS: API liveness and readiness
PASS: Swagger, deterministic seed, and frontend smoke checks

npm ci
PASS: clean workspace installation

npm run verify
PASS: backend and frontend lint (warnings only)
PASS: 31 unit tests
PASS: 8 PostgreSQL-backed behavioral and migration e2e tests
PASS: backend build
PASS: frontend build

npm run dev:dependencies
PASS: PostgreSQL and Redis healthy
PASS: migration runner repeated successfully with 0 pending migrations
```

Known non-blocking output:

- Existing backend and frontend lint warnings remain.
- Vite reports the existing large JavaScript chunk warning.
- npm reports existing deprecated transitive packages and blocked install scripts; dependency cleanup is outside this migration checkpoint.

### Phase 3 checkpoint 1 — Reliable eventing and first durable slice

- Added explicit versioned durable and replaceable-live event envelopes plus provider-independent eventing interfaces.
- Added versioned PostgreSQL migrations for the transactional outbox, consumer inbox, and first-slice projection.
- Added the Redis Streams relay, consumer group, pending-message reclaim, bounded retries, dead-letter stream, and relay failure metadata.
- Added a separate Redis Pub/Sub adapter with fan-out and replaceable-message recovery coverage.
- Migrated `tournament.created` version 1 as the first low-risk slice: tournament creation and its outbox record are atomic, duplicate delivery creates one inbox record and one projection effect, and existing synchronous behavior remains intact.
- Added automated PostgreSQL and Redis coverage for atomic rollback, relay outage and restart recovery, consumer restart, duplicate delivery, poison messages, dead-letter handling, Pub/Sub fan-out, and missed-message recovery.

Verification result:

```text
npm run verify
PASS: backend and frontend lint (warnings only)
PASS: 33 unit tests, including versioned contract validation
PASS: 13 PostgreSQL/Redis-backed behavioral, migration, and eventing e2e tests
PASS: backend and frontend builds

npm run local:up
PASS: images rebuilt and additive eventing migration applied to retained PostgreSQL data
PASS: PostgreSQL, Redis, backend, migrations, and frontend healthy

npm run verify:local
PASS: 2 PostgreSQL and Redis platform integration tests
PASS: 13 PostgreSQL/Redis-backed e2e tests
PASS: API liveness and readiness
PASS: Swagger, deterministic seed, and frontend smoke checks
```

Known non-blocking output:

- Existing backend and frontend lint warnings remain.
- Vite reports the existing large JavaScript chunk warning.

### Phase 3 checkpoint 2 — Tournament lifecycle and transport retention

- Added explicit `open` and `closed` tournament lifecycle state with manual close and reopen endpoints.
- Closing disconnects SyncStart lobbies and makes tournament mutation routes return `409 Conflict`; reads and authorized reopen remain available.
- Added frontend lifecycle controls with the configured retention period in the destructive close confirmation and read-only UI state.
- Standardized tournament-scoped durable event aggregate IDs on the tournament ID.
- Added atomic Redis indexing for Stream, retry, pending, and dead-letter cleanup without global scans.
- Added replica-safe, configurable retention with batched PostgreSQL deletion, Redis cleanup, purge status, and a global advisory lock that prevents concurrent sweeps across service replicas.
- Simplified lifecycle concurrency after review: retention is not coordinated with manual close or reopen operations, eligibility is not repeated after candidate selection, and lifecycle changes do not acquire row or per-tournament advisory locks.
- The retention policy deliberately deletes every transport artifact, including unpublished outbox and dead-letter records, after the tournament has remained closed for the configured period.
- Added lifecycle and retention e2e coverage, including read-only enforcement, reopen, PostgreSQL cleanup, Redis entry removal, pending-state removal, and dead-letter removal.

Verification result:

```text
npm run verify
PASS: backend and frontend lint (warnings only)
PASS: 33 unit tests
PASS: 16 PostgreSQL/Redis-backed behavioral, migration, lifecycle, and eventing e2e tests
PASS: backend and frontend builds

npm run local:up
PASS: lifecycle/retention migration applied to retained PostgreSQL data
PASS: PostgreSQL, Redis, backend, migrations, and frontend healthy

npm run verify:local
PASS: 2 PostgreSQL and Redis platform integration tests
PASS: 16 PostgreSQL/Redis-backed e2e tests
PASS: API liveness and readiness
PASS: Swagger, deterministic seed, and frontend smoke checks
```

Known non-blocking output:

- Existing backend and frontend lint warnings remain.
- Vite reports the existing large JavaScript chunk warning.

### Phase 3 checkpoint 3 — Concurrency simplification review

- Confirmed the project rule to keep implementations as simple as reasonably possible and to obtain user approval before introducing substantial architectural or concurrency complexity.
- Limited concurrency protection to application scaling and failure scenarios: the global retention-sweep lock, relay row claiming with `FOR UPDATE SKIP LOCKED`, inbox deduplication, atomic database transactions, and atomic Redis Stream/index writes remain.
- Removed the per-tournament advisory lock, the repeated retention eligibility query, and lifecycle row locking. Rare overlaps between retention or tournament mutations and manual lifecycle actions are deliberately accepted during pre-production.
- Phase 3 remains complete after this simplification review.

Verification result:

```text
npm run verify
PASS: backend and frontend lint (warnings only)
PASS: 33 unit tests
PASS: 16 PostgreSQL/Redis-backed e2e tests
PASS: backend and frontend builds
```

Known non-blocking output:

- Existing backend and frontend lint warnings remain.
- Vite reports the existing large JavaScript chunk warning.

## Characterization Findings

- See [FunctionalQuestions.md](FunctionalQuestions.md) for the inspectable post-migration decision backlog.

## Next Recommended Checkpoint

Begin Phase 4 with one explicit stateless handler slice, preserving its synchronous path until parity, idempotency, and restart tests pass.

## Remaining Phase 0 Work

- None within the approved scope.

## Approved Deferred Coverage

- Start.gg must remain intact and currently functional, without migration tests. Its future approach will be decided after the architecture migration.
- SyncStart integration and protocol testing is deferred until the separate SyncStart service is implemented in Phase 6.
- Browser WebSocket event names and responsibilities remain inventoried in [BaselineInventory.md](BaselineInventory.md); network, reconnect, and recovery tests are deferred to the realtime extraction in Phase 7.

## Handoff Rules

After completing a checkpoint:

1. Update the current position if the active phase or gate state changed.
2. Add the completed work and exact verification result to this file.
3. Replace the next recommended checkpoint with the next concrete task.
4. Update [MigrationPlan.md](MigrationPlan.md) only when phase-level progress or risks change.
5. Create a focused local commit when the checkpoint is coherent and verified; separate approval is not required.
