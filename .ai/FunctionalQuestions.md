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

### FQ-010 — Judgment colour assignment on live score cards

- Status: Open.
- Observed behavior: `LiveScoreCard` paints `judgments.fantasticPlus` with the blue judgment colour, while `judgments.fantastics` carries no colour of its own and inherits the card text, which is white. In the In The Groove palette the white window is Fantastic+ and the blue one is Fantastic, so the two appear to be swapped. The colours were left exactly as the component assigned them; only their hex values were snapped to the game palette.
- Question: Should Fantastic+ be white and Fantastic blue, matching the cabinet? If so, Fantastic needs the blue token and Fantastic+ needs an explicit white one, because it can no longer rely on inheriting the card text.
- Evidence: `apps/frontend/src/features/live/components/LiveScoreCard.tsx` and the `judgment` scale in `apps/frontend/tailwind.config.js`.

### FQ-011 — Judgment colours after a run is completed

- Status: Open.
- Observed behavior: a completed live score card switches to a light summary surface and renders every judgment count in one inherited colour, so the game colouring is only visible while a player is still running. A running card keeps the near-black `live-screen` surface, which the judgment palette needs to stay legible.
- Question: Should a completed card keep the game colours, so results can still be scanned per judgment window after the run? Doing so means completed cards become dark surfaces too, and pass or fail moves to a border or a label rather than the card fill.
- Evidence: `apps/frontend/src/features/live/components/LiveScoreCard.tsx`.

### FQ-012 — Hand-scored points are a per-device draft

- Status: Closed on 2026-08-22.
- Observed behavior: a match with no songs was scored by hand through a switch and a points draft kept in `localStorage`. The points reached the server only on commit, so two staff members scoring the same match each held their own draft, the sidebar could not mark a match that was waiting, and the division standings never saw the result.
- Decision taken: hand scoring is no longer a device state. It is a round with no song, and its points are standings like any other, written to the server as they are typed. The draft, its store and its hook are gone. See [ScoringRefactoring.md](ScoringRefactoring.md).
- What the answer turned out to be: the question asked whether the draft should be shared or stay local. Neither: the draft itself was the accident. Once a hand-scored match has a round, there is nothing left that only one device knows.

### FQ-013 — Changes between an HTTP read and the realtime connection

- Status: Open.
- Observed behavior: a page loads its state over HTTP and opens its realtime socket at roughly the same moment. The `RealtimeReady` frame carries the cached messages of the tournament, but `TournamentUpdatesProvider` ignores replayed messages, because on `/uiupdatehub` they are only invalidation signals and re-reading history would refetch the whole tournament on every load. A change committed in the window between the HTTP read and the socket connection is therefore announced by a signal the client discards, and the page keeps showing the value it fetched until the next live event arrives.
- Question: Should an HTTP response state the realtime sequence it reflects, so a connecting client can compare it against the ready frame and recover only when it is genuinely behind? That is the only way to tell "history I already have" from "history I missed" without re-reading everything.
- Evidence: `apps/frontend/src/shared/realtime/useRealtimeSocket.ts`, `apps/frontend/src/features/tournament/context/TournamentUpdatesContext.tsx`, and `apps/realtime/src/browser/websocket-browser-event.broadcaster.ts`.
- Rule: the window is the page-load gap only, and any later event repairs the view. Do not add sequence stamping to the HTTP contracts before the user asks for it.

### FQ-014 — Advancement writes into a completed target match

- Status: Open.
- Observed behavior: a completed match refuses every edit a person makes — its entrants, its pool, its scoring system, its rounds and its standings are all frozen until the result is reopened. Advancement is not held to that rule: committing or reopening a match places its entrants into the target matches its rules name, and a target that already holds a result of its own is written just the same. The behavior predates the match aggregate, where the check sat in `MatchManager` rather than in the write path itself; phase 2 kept it by calling `MatchAggregate.assertEditable` from the commands a person reaches and not from the advancement path.
- Question: Should advancement refuse a completed target, or is writing through it correct? Refusing leaves a bracket half advanced when a downstream match was committed early, which is worse than the current behavior; the alternative is to reopen the target and cascade, which nothing asks for today.
- Evidence: `apps/api/src/tournament/competition/match/match.aggregate.ts`, `apps/api/src/tournament/competition/match/match.commands.ts`, and `apps/api/src/tournament/competition/match/services/advancement.manager.ts`.
- Rule: keep the current behavior until the user names a case where it produces a wrong bracket.

### FQ-015 — The seeding tab cannot read back the order it saved

- Status: Partly resolved on 2026-08-23; the remaining question is below.
- Observed behavior: `SeedingTab` sorted the division's entrants by `seedNum`, falling back to the name. Its entrants come from `GET /divisions/:id/summary`, whose projection carries `id`, `name`, `type`, `status` and participants and never carried a seed, so the sort key was always undefined and the tab has always opened on the alphabetical order. `PATCH /divisions/:id/entrants/seeding` writes `seedNum`, and `GET /divisions/:id/entrants` returns it, but the page the person seeds from reads neither. Phase 3 of the API refactoring made the type honest and removed the dead sort key; the display is unchanged, because it never ran.
- Question: Should the summary carry each entrant's seed, so the tab reopens on the saved order? The alternative is that seeding is a one-way instruction and the persisted order is only ever consumed by bracket generation, in which case the tab should say so rather than presenting an order that looks like the stored one.
- Evidence: `apps/frontend/src/features/division/components/SeedingTab.tsx`, `apps/api/src/tournament/shared/projections.ts`, and `apps/api/src/tournament/structure/services/division.service.ts` (`findOneForSummary`).
- Resolution of the display half, 2026-08-23: phase 5 gave the tab the roster from `GET /divisions/:id/entrants`, which the API orders by the persisted seed with the unseeded entrants last. The tab shows that order instead of sorting by name, so it now opens on the order its last save wrote. The summary no longer carries entrants at all; it states how many there are.
- Still open: no response carries `seedNum` itself, so nothing can show a person the number beside a name or tell a seeded entrant from an unseeded one. Whether it should is the remaining question.
- Rule: adding `seedNum` to `EntrantDto` needs a reader first. The order is visible now, which is what the tab was for.

### FQ-016 — What a tournament's statistics page should show

- Status: Open. The page is empty by decision, taken on 2026-08-22.
- Observed behavior: the statistics page had two halves, neither of which answered a question anybody had asked. The lower half listed every score every player had run, built by downloading the whole tournament graph over `GET /divisions?tournamentId=` — raw TypeORM entities, divisions through phases, matches, rounds, standings and scores — and recomputing the totals in the browser. The upper half showed three counters, divisions, players and matches, taken from the tournament overview because the overview happened to carry them. The endpoint, the score table, the counters and the types that described them have been removed, and the page says it is being rebuilt.
- Question: What numbers does a tournament need, and who reads them? A table of every score is a log, not a statistic. Candidates the removed page hinted at without answering: per-player averages across a division, a song's difficulty measured by how people actually score on it, a pool's progress against its schedule, a player's results across the tournaments they have entered.
- Evidence: the removal commit on branch `refactor/5-stats-placeholder`; `apps/frontend/src/pages/tournament/StatsPage.tsx`.
- Update, 2026-08-23: the division standings page is gone too, on the user's instruction that every number a tournament reports belongs on Stats. `GET /divisions/:id/standings` and `StandingsQueries.forDivision` were kept rather than removed with it — they are the one aggregate of this application that is already written, already tested against a real PostgreSQL, and named by the question above. That leaves one read endpoint with no consumer, which is a deliberate exception to the rule this repository otherwise applies; if Stats turns out not to want a per-division roll-up, the query goes.
- Rule: do not add a statistics read model to phase 5 of [ApiRefactoring.md](ApiRefactoring.md). The page stays empty until the question above has an answer, and the answer decides the query rather than the other way round.

### FQ-017 — Whether a tournament response should name its staff

- Status: Open. The field was removed on 2026-08-22.
- Observed behavior: `TournamentDto` declared `staff: TournamentStaffDto[]`, mapped in `TournamentManager.toResponseDto` from `tournament.participants` filtered to the ones holding the `staff` role and a linked account. Every loader behind that mapping — `findOne`, `findOneForPage`, `findOneForUpdate` — read the tournament row alone and never loaded its participants, so the array was empty in every response the API has ever sent. No frontend consumer read it. Phase 5 of [ApiRefactoring.md](ApiRefactoring.md) removed the field rather than making the load fetch what the mapper assumed.
- Question: Should a tournament response name its staff? Nothing on screen shows them today; the participants page lists roles per participant and reads `GET /tournaments/:id/participants`, which is a separate call with its own permission. If a header or a card should credit the staff, the field returns as a deliberate projection with a load behind it.
- Evidence: the removal commit on branch `refactor/5-tournament-reads`; `packages/contracts/src/tournament.ts`; `apps/frontend/src/pages/tournament/ParticipantsPage.tsx`.
- Rule: do not restore the field speculatively. A reader has to exist first.
