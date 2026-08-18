# Architecture Migration Work Plan

## Goal

Migrate Tournament Manager from the current NestJS backend into the target API, processor, SyncStart, realtime, and frontend topology without losing the ability to run and verify the complete application after any completed phase.

This plan implements the decisions in [Architecture.md](Architecture.md). It is intentionally incremental: a phase may start only when the preceding phase passes its exit gate.

## Non-Negotiable Delivery Rules

- The default branch must remain buildable, runnable, and testable after every merge.
- Each change must preserve a complete working path. Do not merge a producer before its required consumer, or remove an old path before the replacement passes parity tests.
- Migrate one vertical behavior slice at a time. A slice includes its contract, producer, transport, consumer, persistence, UI effect, and tests.
- Every phase must add or update automated tests before its legacy implementation is removed.
- Fix regressions in the current phase. Do not defer them to a later migration phase.
- Keep local testing independent from cloud providers. Neon and managed Redis may be deployment targets, but never local test requirements.
- Use production-equivalent PostgreSQL, Redis, containers, migrations, protocols, and event contracts locally.
- Destructive persistence changes require a tested forward migration and, where feasible, a rollback or restore procedure.

## Execution and Commit Protocol

- Use [MigrationStatus.md](MigrationStatus.md) as the durable handoff record. Read it before starting migration work and update it after every completed checkpoint.
- Contributors and coding agents may create local Git commits without asking for separate approval at each step.
- Commit at coherent, reviewable checkpoints: a protected behavior slice, a test-infrastructure increment, a migration, or another independently verifiable unit of work.
- Before committing, run the verification appropriate to the changed scope and record the command and result in `MigrationStatus.md`.
- Keep commits focused. Do not include unrelated user changes, secrets, generated runtime data, known regressions, or a producer whose required consumer is not available.
- A phase may span multiple commits. Passing a checkpoint does not imply that the phase exit gate has passed.
- Commit messages must be in English and describe the completed outcome.

## Required Developer Commands

The migration must progressively establish and preserve these repository-root commands:

```text
npm ci
npm run local:up          # Build and start the complete local stack
npm run local:status      # Show service health and migration status
npm run local:logs        # Inspect the complete stack
npm run local:down        # Stop the stack without deleting persistent data
npm run local:reset       # Explicitly delete and recreate local data
npm run test:unit         # Fast isolated tests
npm run test:integration  # PostgreSQL and Redis integration tests
npm run test:e2e          # Complete API, event, WebSocket, and UI workflows
npm run verify            # Lint, type-check, unit tests, and builds
npm run verify:local      # Health checks, migrations, integration tests, and e2e tests
```

These are target command contracts. A command becomes mandatory from the phase that introduces it. `local:reset` must always be explicit and must never be part of normal startup.

## Permanent Test Layers

### Unit tests

Cover managers, use cases, domain rules, event mapping, contract validation, and idempotency decisions without network dependencies.

### Integration tests

Run against real PostgreSQL and Redis containers. Cover repositories, migrations, transactions, outbox relay, Streams consumer groups, inbox deduplication, retries, dead-letter handling, and Pub/Sub adapters.

### Contract tests

Validate versioned command, domain-event, UI-event, and SyncStart payloads at producer and consumer boundaries. Database entities must never be accepted as event contracts.

### End-to-end tests

Exercise the deployed local containers through public HTTP and WebSocket interfaces. At minimum they must cover:

- local authentication and authorization;
- tournament, division, participant, song, phase, and match management;
- standings calculation and bracket advancement;
- lobby lifecycle and persisted song results;
- Start.gg integration through a deterministic stub server;
- SyncStart behavior through a deterministic protocol simulator;
- durable event delivery, duplicate delivery, consumer restart, and Redis recovery;
- browser realtime updates, disconnect, reconnect, sequence-gap detection, and HTTP snapshot recovery;
- frontend loading and one critical user journey through a browser smoke test.

### Operational smoke tests

Verify health endpoints, readiness dependencies, migrations, clean startup, restart with retained volumes, graceful shutdown, and recovery after temporarily stopping PostgreSQL, Redis, or an event consumer.

## Phase 0 — Baseline and Safety Net

### Progress

- In progress.
- Root `npm run verify` command established.
- Placeholder e2e test replaced with the first behavioral tournament-management workflow and reusable fixtures.
- Current route, realtime, integration, and workflow inventory recorded in [BaselineInventory.md](BaselineInventory.md).
- Remaining before the exit gate: focused domain tests, deterministic Start.gg and SyncStart doubles, broader behavioral coverage, and clean-install verification.

### Work

- Inventory current HTTP routes, WebSocket messages, scheduled or observer-driven behavior, integrations, and critical user journeys.
- Replace the placeholder NestJS e2e test with behavioral tests for the current application.
- Add focused unit tests around standings, bracket advancement, match workflow, lobby state, and result persistence before moving those behaviors.
- Add deterministic Start.gg and SyncStart test doubles; tests must not call external services.
- Record representative request, response, and WebSocket fixtures for later parity tests.
- Make `npm run verify` reliable at the repository root.

### Exit gate

- Current frontend and backend build successfully.
- Lint, unit tests, and behavioral backend e2e tests pass from a clean install.
- The documented critical workflows have automated coverage or an explicitly documented temporary manual test with an owner and removal phase.
- No production behavior has been intentionally changed.

## Phase 1 — Reproducible Local Platform

### Work

- Add PostgreSQL and Redis to Docker Compose with pinned image versions, named volumes, and health checks.
- Introduce the one-command `local` stack and the local verification commands.
- Add service health and readiness endpoints. Readiness must distinguish unavailable PostgreSQL and Redis.
- Add automatic database migration execution before application readiness.
- Provide deterministic seed data or fixtures for local e2e tests.
- Document startup, status, logs, shutdown, backup, restore, and explicit reset procedures.

### Exit gate

- A clean machine with Node.js, npm, Docker, and Docker Compose can start the complete stack without a cloud account.
- `npm run local:up` followed by `npm run verify:local` passes.
- Fresh-volume startup, retained-volume restart, and application restart pass.
- Frontend, API, Swagger, PostgreSQL, and Redis readiness can be verified locally.

## Phase 2 — PostgreSQL-Only Persistence

### Work

- Create versioned PostgreSQL migrations for the existing schema; disable TypeORM schema synchronization.
- Run repository and application integration tests exclusively against PostgreSQL.
- Validate migrations against both an empty database and a copy or schema-equivalent fixture of the deployed PostgreSQL database.
- Switch every local and test path to PostgreSQL.
- Remove SQLite and MariaDB configuration branches, dependencies, documentation, and scripts only after PostgreSQL parity passes.

### Exit gate

- Empty-database creation and upgrade of an existing PostgreSQL schema both pass.
- All critical behavioral tests pass against PostgreSQL.
- No runtime or test dependency on `sqlite3`, `mysql2`, SQLite, or MariaDB remains.
- The complete local stack still passes `npm run verify:local`.

## Phase 3 — Contracts and Eventing Inside the Existing Backend

### Work

- Create shared, versioned event contracts and provider-independent eventing interfaces.
- Add PostgreSQL outbox and consumer inbox tables through migrations.
- Implement the outbox relay, Redis Streams adapter, consumer groups, bounded retry, dead-letter stream, and observability metadata.
- Implement Redis Pub/Sub separately for replaceable live events.
- Keep the first producers and consumers inside the existing backend so transport reliability can be tested before service extraction.
- Migrate one low-risk event slice first, then expand only after its failure tests pass.

### Exit gate

- A domain change and its outbox record commit atomically.
- Relay restart does not lose events; duplicate delivery does not duplicate business effects.
- Consumer restart, Redis outage and recovery, poison-message retry, and dead-letter behavior pass automated tests.
- Pub/Sub tests demonstrate fan-out and explicitly confirm that missed replaceable messages are recovered by a later update or snapshot.
- Legacy synchronous behavior remains available for every slice not yet migrated.

## Phase 4 — Stateless Event Handlers

### Work

- Convert observer-driven behavior into explicit handlers one use case at a time.
- Keep managers and reusable application use cases independent from controllers, transports, and repositories.
- Migrate standings, bracket advancement, match state, result persistence, projections, lobby state, notifications, cache invalidation, and UI-event conversion as separate vertical slices.
- Persist workflow progress and make each handler idempotent through inbox and business invariants.
- Keep Start.gg request/response behavior synchronous unless a specific workflow is intentionally converted to a durable command.

### Exit gate

- Each migrated slice passes unit, PostgreSQL integration, Redis delivery, duplicate-delivery, and end-to-end parity tests.
- Replaying an already processed event produces no additional business effect.
- Stopping and restarting the handler loses no durable work.
- No handler depends on process-local authoritative state.

## Phase 5 — Processor Extraction

### Work

- Create `apps/processor` and move only the already-tested stateless handlers and outbox relay into it.
- Move reusable managers and use cases required by both API and processor into shared application packages.
- Give API and processor independent entrypoints, configuration, health checks, Docker images, and logs.
- Remove migrated handler execution from the API only after the processor path passes the same tests.

### Exit gate

- API and processor build and run independently.
- With the processor stopped, durable events remain pending; after restart, processing resumes exactly once at the business level.
- Multiple processor replicas do not duplicate business effects.
- Existing HTTP behavior and the complete local e2e suite remain green.

## Phase 6 — SyncStart Service Extraction

### Work

- Create `apps/syncstart` and move connector ownership, protocol parsing, reconnection, lobby sessions, and volatile connection state into it.
- Consume durable commands and publish durable outcomes through Redis Streams.
- Publish replaceable high-frequency telemetry through Redis Pub/Sub.
- Keep tournament rules, persistence orchestration, frontend DTOs, and bracket logic outside this service.
- Use the SyncStart simulator for normal, malformed, disconnected, reconnecting, and duplicate scenarios.

### Exit gate

- SyncStart can be stopped and restarted without losing durable commands or corrupting lobby state.
- Reconnection and command idempotency pass automated tests.
- Live telemetry reaches subscribers while the durable result path still succeeds during subscriber outages.
- The full tournament flow passes without SyncStart code running inside the API.

## Phase 7 — UI Realtime Service Extraction

### Work

- Create `apps/realtime` and move browser WebSocket authentication, rooms, subscriptions, and fan-out into it.
- Consume prepared UI events; do not move domain calculations into realtime.
- Use Redis Pub/Sub to distribute replaceable live updates across realtime replicas.
- Add scoped sequence numbers where ordered incremental UI delivery is required.
- Update the frontend to reconnect and reload an HTTP snapshot after disconnect or sequence gap.

### Exit gate

- Two local realtime replicas deliver the correct scoped events without cross-tournament leakage.
- Browser disconnect, reconnect, missed Pub/Sub message, sequence gap, and snapshot recovery pass e2e tests.
- Restarting realtime loses only connections and replaceable messages, never authoritative state.
- The complete application remains usable through HTTP while realtime is unavailable.

## Phase 8 — Final Monorepo Boundaries and Cleanup

### Work

- Finalize `apps/api`, `apps/processor`, `apps/syncstart`, `apps/realtime`, and `apps/frontend`.
- Finalize shared `application`, `contracts`, and `eventing` packages with explicit dependency boundaries.
- Remove superseded gateways, observers, compatibility adapters, old entrypoints, and obsolete environment variables.
- Add architecture dependency checks so transport and persistence details cannot leak into domain code.
- Update all operational and developer documentation to describe only the supported topology.

### Exit gate

- Every application builds and tests independently and as part of the complete stack.
- No removed database or legacy in-process event path remains.
- Dependency-boundary tests pass.
- A clean checkout passes `npm ci`, `npm run verify`, `npm run local:up`, and `npm run verify:local` using the documented procedure.

## Phase 9 — Continuous Delivery and Deployment Validation

### Work

- Add GitHub Actions for immutable image builds, lint, type-checking, unit, integration, contract, and e2e tests.
- Publish images tagged with the Git commit SHA only after all required checks pass.
- Add migration, deployment, readiness, smoke-test, and rollback stages.
- Keep provider configuration in deployment adapters and environment configuration.
- Validate the chosen free-tier deployment without changing local or application contracts.

### Exit gate

- Pull requests cannot merge when required verification fails.
- A merge to `main` deploys the exact tested images, applies migrations once, verifies readiness, and runs smoke tests.
- A failed migration, readiness check, or smoke test prevents promotion and has a documented recovery path.
- The same images can still be run and fully tested with the local configuration.

## Per-Slice Completion Checklist

A migrated behavior is complete only when all applicable items are true:

- ownership and contract are documented;
- unit and contract tests pass;
- PostgreSQL transaction and migration behavior pass;
- outbox/inbox and duplicate-delivery behavior pass for durable events;
- Redis outage and restart behavior pass where applicable;
- HTTP and WebSocket end-to-end behavior pass;
- frontend snapshot and reconnect behavior pass where applicable;
- health, logs, correlation IDs, and failure visibility are present;
- local startup and the complete regression suite remain green;
- the superseded path is removed only after parity is proven.

## Current Baseline Risks

- The backend e2e suite protects authentication and basic tournament management, but the remaining critical tournament workflows are not yet covered.
- Current local scripts and Docker Compose use SQLite, while the target requires PostgreSQL only.
- TypeORM currently uses schema synchronization instead of production-safe versioned migrations.
- Redis, outbox, inbox, retry, dead-letter, and extracted-service test infrastructure do not yet exist.

These risks make Phase 0 and Phase 1 mandatory. Service extraction must not begin before their exit gates pass.
