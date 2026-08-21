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

- Status: Resolved.
- Observed behavior: the creation DTO accepted `syncstartUrl`, `startggApiKey`, `availableSetupsCount`, and `defaultScoringSystem`, while `TournamentService.create` applied only `name` and `syncstartUrl`. The remaining accepted fields were silently discarded.
- Decision: creation takes the minimal set of information, which is the tournament name alone. Every other setting keeps its persisted entity default and is edited afterwards in the dedicated tournament configuration page, which is the single place where configuration is owned.
- Implementation: `CreateTournamentDto` declares only `name`; `TournamentService.create` sets only the name; `TournamentsController.create` configures SyncStart from the tournament's persisted `syncstartUrl` instead of a creation field, so a new tournament always reaches SyncStart with its effective URL; the frontend creation modal asks for the name only and points to the configuration page.

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

### FQ-006 — Start.gg reporting on match completion

- Status: Resolved.
- Observed behavior: `CommitMatchResultDto.publishToStartgg` was documented as optional and defaulting to false, but `MatchWorkflowManager.CommitMatchResult` always called `StartggService.reportCompletedMatch` after local completion. Because that method rejected any match without a start.gg set mapping, and no frontend caller set the flag, every match completion failed with `Match <id> is not mapped to a start.gg set` after the local result had already been persisted and advanced.
- Decision: reporting is automatic and never blocks local completion. `StartggService.reportCompletedMatch` returns `null` when the match has no start.gg set mapping or the tournament has no start.gg API key, `MatchWorkflowManager` treats a provider failure as a non-fatal outcome, and the completion response carries a `startggReport` status of `reported`, `skipped`, or `failed` so the UI can state whether the result also reached start.gg. The `publishToStartgg` opt-in flag was removed from the API DTO and the frontend request type.
- Implementation: `apps/api/src/integrations/startgg/startgg.service.ts`, `apps/api/src/tournament/competition/match/services/match-workflow.manager.ts`, `apps/api/src/tournament/competition/match/dtos/match.dto.ts`, and `apps/frontend/src/features/match/services/useMatches.ts`.

### FQ-007 — SyncStart isolated-restart reconciliation

- Status: Deferred defect.
- Observed behavior: `TournamentSyncStartBootstrap` pushes persisted configuration only when the API starts. If SyncStart restarts while the API remains running, its replica-local tournament runtimes are lost and are not recreated until the API restarts or a tournament configuration changes.
- Expected behavior: an isolated SyncStart restart should recover configured open-tournament runtimes from the authoritative API bootstrap query.
- Evidence: compare `apps/api/src/tournament/syncstart/tournament-syncstart.bootstrap.ts` with `GET /internal/syncstart/tournaments` in `apps/api/src/internal.controller.ts`; SyncStart currently has no startup consumer for that endpoint.
- Remediation rule: move startup reconciliation ownership to SyncStart and adjust Compose startup ordering in a separate operational change; do not introduce polling, durable messaging, or distributed coordination.

### FQ-008 — Automatic bracket generation quality

- Status: Deferred.
- Observed behavior: `BracketManager.generateForDivision` creates a phase, a pool, and a bracket in one call, reading the seeded entrants of the pool through `PhaseGroupService.getEntrantsForBracket`. `SingleElimination` builds every round from a player count and then fills the first wave. The user reports the produced brackets are not what they expect, without a single reproducible defect yet.
- Question: What should generation produce for a given entrant count, seeding, players per match, and bye distribution, and should the structure be generated before the entrants are known so that advancement rules fill its slots?
- Related consequence: the division now owns the seeding order (`Entrant.seedNum`), while generation still reads the per-pool `PhaseGroupEntrant.seedNum`. The pool seeding is derived from the division order when a match introduces an entrant, so the two agree for pools built by hand, but a regenerated bracket does not re-read the division order.
- Evidence: `apps/api/src/tournament/competition/bracket/bracket.manager.ts`, `apps/api/src/tournament/competition/bracket/SingleElimination.ts`, and `apps/api/src/tournament/structure/services/phase-group.service.ts`.
- Rule: collect concrete failing cases with the user before changing the generators.

### FQ-009 — Pool bracket type as a display choice

- Status: Deferred.
- Observed behavior: `PhaseGroup.bracketType` carries two meanings. Locally it decides how the frontend draws the matches of a pool: raw cards, a round robin table, or a bracket tree. For an imported pool it also mirrors the provider value, which `StartggService.mapStartggBracketType` translates in both directions.
- Decision taken: the user may now change it freely from the pool view, so it is treated as a display choice. Generation is unaffected because `BracketManager.generateForPhaseGroup` receives the bracket type as an explicit argument instead of reading the field.
- Question: Should an imported pool keep a separate provider-owned field, so a local display choice never makes the stored value diverge from start.gg?
- Evidence: `apps/api/src/integrations/startgg/startgg.service.ts`, `apps/frontend/src/features/division/components/PhaseGroupViewSelect.tsx`, and `apps/frontend/src/features/match/components/MatchList.tsx`.
