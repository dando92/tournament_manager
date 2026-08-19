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
- Evidence: `apps/backend/src/tournament/services/scoring-systems/scoring-systems.spec.ts` characterizes the current behavior.
- Migration rule: Preserve the observed behavior until this question is resolved.

### FQ-002 — Lobby code uniqueness across tournaments

- Status: Deferred.
- Observed behavior: `LobbyManager` stores metadata in a process-wide map keyed only by normalized lobby code. The same active code can therefore collide across two tournaments.
- Question: Is a lobby code globally unique, or should lobby identity be scoped by tournament and code?
- Evidence: `apps/backend/src/tournament/services/lobby-manager.service.ts` uses `Map<string, LobbyMeta>`.
- Migration rule: Do not choose a new identity scope during service extraction without resolving this question.

### FQ-003 — Tournament creation configuration fields

- Status: Deferred.
- Observed behavior: the creation DTO accepts `startggApiKey`, `availableSetupsCount`, and `defaultScoringSystem`, while `TournamentService.create` currently applies only `name` and `syncstartUrl`.
- Question: Should all accepted creation fields be persisted immediately, or should some remain update-only configuration?
- Evidence: compare `CreateTournamentDto` with `TournamentService.create`.
- Migration rule: Preserve current creation behavior until this question is resolved.

### FQ-004 — Local administrator ownership persistence

- Status: Deferred.
- Observed behavior: local API-key authentication issues the synthetic account id `local-admin`, while tournament creation attempts to persist an owner participant through `AccountService.ensurePlayer`, which requires a database account.
- Question: Should local mode create a persisted administrator account, omit persisted ownership, or use a different ownership model?
- Evidence: compare `AuthService.loginWithApiKey`, `TournamentManager.create`, and `ParticipantService.ensureOwner`.
- Migration rule: Do not redesign local ownership implicitly while moving authentication or persistence boundaries.

### FQ-005 — Browser realtime access policy

- Status: Deferred.
- Observed behavior: the legacy browser gateways accepted anonymous connections, and tournament read views are public. Phase 7 preserves that behavior while moving connection and tournament-subscription validation to `apps/realtime`.
- Question: Should any realtime paths require a JWT, or should all tournament-scoped update feeds remain public read surfaces?
- Evidence: the removed Phase 6 gateway implementations had no authentication guard; `apps/realtime/src/realtime.gateway.ts` validates path and tournament scope but deliberately does not introduce a new access restriction.
- Migration rule: Preserve anonymous read access until the product access policy is explicitly resolved.
