# Deferred Functional Questions

## Purpose

This file is the inspectable backlog for ambiguous product rules and suspected functional defects discovered during the architecture migration. These items are deliberately separate from migration tasks: the migration must preserve and characterize current behavior unless the user explicitly approves an earlier functional change.

## Workflow

- Add an item as soon as a functional doubt is discovered.
- Use a stable `FQ-###` identifier in tests, documentation, and later decisions.
- Record observed behavior and evidence without presenting it as an approved requirement.
- Keep the status `Deferred` during the architecture migration unless the user explicitly changes its priority.
- After the architecture migration, review each item with the user, record the decision, implement it in a focused change, and set its status to `Resolved`.
- Prefer a short regression test that exposes the current behavior. Keep test helpers and production changes simple enough for a future maintainer to understand locally.

## Open Questions

### FQ-001 — Failed score handling in finals

- Status: Deferred.
- Observed behavior: `FinalsCalculator` sorts the supplied standings array in place and can award the point to a failed score when its percentage is higher than a successful score.
- Question: Should every successful score rank ahead of every failed score in finals, regardless of percentage?
- Evidence: `apps/api/tests/unit/tournament/services/scoring-systems/scoring-systems.spec.ts` characterizes the current behavior.
- Migration rule: Preserve the observed behavior until this question is resolved.

### FQ-002 — Lobby code uniqueness across tournaments

- Status: Deferred.
- Observed behavior: each `TournamentSyncStartRuntime` owns an independent `LobbyCatalog` keyed by normalized lobby code. Runtime lookup is keyed by `tournamentId`, so the effective application identity is tournament plus lobby code and equal codes cannot collide across tournaments.
- Question: Is a lobby code globally unique, or should lobby identity be scoped by tournament and code?
- Evidence: `apps/syncstart/src/tournament-syncstart-registry.ts`, `apps/syncstart/src/tournament-syncstart-runtime.ts`, and `apps/syncstart/src/lobby-catalog.ts` own the scoped runtime and projection state; the API owns no lobby state.
- Migration rule: Preserve the current tournament-scoped behavior unless a product requirement explicitly establishes provider-global lobby identity.

### FQ-003 — Tournament creation configuration fields

- Status: Deferred.
- Observed behavior: the creation DTO accepts `startggApiKey`, `availableSetupsCount`, and `defaultScoringSystem`, while `TournamentService.create` currently applies only `name` and `syncstartUrl`.
- Question: Should all accepted creation fields be persisted immediately, or should some remain update-only configuration?
- Evidence: compare `CreateTournamentDto` with `TournamentService.create`.
- Migration rule: Preserve current creation behavior until this question is resolved.

### FQ-004 — Local administrator ownership persistence

- Status: Resolved.
- Observed behavior: local API-key authentication issued the synthetic account id `local-admin`, which existed in no database table. Every query keyed on `Account.id` therefore received a non-uuid value; `TournamentService.getMyRoles` failed with a PostgreSQL uuid cast error, the frontend permission context swallowed the failure and fell back to an empty permission state, and all tournament editing controls disappeared.
- Decision: local mode creates a persisted administrator account. The synthetic identity, the API-key login endpoint, and the `AUTH_MODE` deployment switch were removed; local and deployed environments now share one authentication path and one account model.
- Implementation: the migration runner seeds an administrator account from `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD` when no account with that username exists. Local runs read those values from the repository-root `.env`, deployed runs from deployment secrets. Authentication is `POST /auth/login` in every environment.

### FQ-005 — Browser realtime access policy

- Status: Deferred.
- Observed behavior: the legacy browser gateways accepted anonymous connections, and tournament read views are public. Phase 7 preserves that behavior while moving connection and tournament-subscription validation to `apps/realtime`.
- Question: Should any realtime paths require a JWT, or should all tournament-scoped update feeds remain public read surfaces?
- Evidence: the removed Phase 6 gateway implementations had no authentication guard; `apps/realtime/src/realtime.gateway.ts` validates path and tournament scope but deliberately does not introduce a new access restriction.
- Migration rule: Preserve anonymous read access until the product access policy is explicitly resolved.

### FQ-006 — Start.gg reporting flag is ignored

- Status: Deferred.
- Observed behavior: `CommitMatchResultDto.publishToStartgg` is documented as optional and defaults to false, but `MatchWorkflowManager.CommitMatchResult` always calls `StartggService.reportCompletedMatch` after local completion.
- Question: Should Start.gg reporting occur only when `publishToStartgg` is true, or should reporting remain automatic for every mapped match?
- Evidence: compare `apps/api/src/tournament/competition/match/dtos/match.dto.ts` with `apps/api/src/tournament/competition/match/services/match-workflow.manager.ts`.
- Migration rule: Preserve the current synchronous behavior while extracting `@tournament-manager/startgg`; do not resolve the flag semantics as part of the architectural migration.

### FQ-007 — SyncStart isolated-restart reconciliation

- Status: Deferred defect.
- Observed behavior: `TournamentSyncStartBootstrap` pushes persisted configuration only when the API starts. If SyncStart restarts while the API remains running, its replica-local tournament runtimes are lost and are not recreated until the API restarts or a tournament configuration changes.
- Expected behavior: an isolated SyncStart restart should recover configured open-tournament runtimes from the authoritative API bootstrap query.
- Evidence: compare `apps/api/src/tournament/syncstart/tournament-syncstart.bootstrap.ts` with `GET /internal/syncstart/tournaments` in `apps/api/src/internal.controller.ts`; SyncStart currently has no startup consumer for that endpoint.
- Remediation rule: move startup reconciliation ownership to SyncStart and adjust Compose startup ordering in a separate operational change; do not introduce polling, durable messaging, or distributed coordination.
