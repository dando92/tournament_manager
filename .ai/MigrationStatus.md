# Migration Execution Status

## Purpose

This is the durable handoff record for migration work. Future contributors and coding agents must read this document together with [MigrationPlan.md](MigrationPlan.md) before making migration changes. Update it after every completed checkpoint so that the repository always states what is done, what was verified, and what should happen next.

Functional ambiguities and suspected behavior defects are tracked separately in [FunctionalQuestions.md](FunctionalQuestions.md). Migration work must link new findings there instead of silently deciding them.

## Current Position

- Last updated: 2026-08-18.
- Active phase: Phase 0 — Baseline and Safety Net.
- Phase state: in progress; the Phase 0 exit gate has not passed.
- Service extraction is not authorized yet because Phase 0 and Phase 1 exit gates remain open.

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

Known non-blocking output:

- Existing backend and frontend lint warnings remain.
- Vite reports an existing large JavaScript chunk warning.

## Characterization Findings

- See [FunctionalQuestions.md](FunctionalQuestions.md) for the inspectable post-migration decision backlog.

## Next Recommended Checkpoint

Add behavioral persistence coverage for score and match-result writes using the current local test database. Keep this separate from the later PostgreSQL integration layer so the Phase 0 behavior remains independently characterized.

## Remaining Phase 0 Work

- Add behavioral persistence coverage for scores and match results.
- Add deterministic Start.gg test doubles and behavioral coverage.
- Add a deterministic SyncStart protocol simulator and behavioral coverage.
- Add representative WebSocket fixtures for later parity tests.
- Expand behavioral coverage for participants and tournament structure.
- Verify the full Phase 0 gate from a clean `npm ci` installation.

## Handoff Rules

After completing a checkpoint:

1. Update the current position if the active phase or gate state changed.
2. Add the completed work and exact verification result to this file.
3. Replace the next recommended checkpoint with the next concrete task.
4. Update [MigrationPlan.md](MigrationPlan.md) only when phase-level progress or risks change.
5. Create a focused local commit when the checkpoint is coherent and verified; separate approval is not required.
