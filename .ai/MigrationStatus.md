# Migration Execution Status

## Purpose

This is the durable handoff record for migration work. Future contributors and coding agents must read this document together with [MigrationPlan.md](MigrationPlan.md) before making migration changes. Update it after every completed checkpoint so that the repository always states what is done, what was verified, and what should happen next.

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

Known non-blocking output:

- Existing backend and frontend lint warnings remain.
- Vite reports an existing large JavaScript chunk warning.

## Next Recommended Checkpoint

Add focused characterization tests for the highest-risk stateless domain behavior, beginning with standings calculation. Continue with bracket advancement and match workflow as separate reviewable checkpoints. Preserve current behavior; record defects exposed by characterization before deciding whether to change them.

## Remaining Phase 0 Work

- Add focused tests for standings calculation.
- Add focused tests for bracket advancement.
- Add focused tests for match workflow and result persistence.
- Add focused tests for lobby state behavior.
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
