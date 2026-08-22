# Migration Execution Status

## Current Position

- Last updated: 2026-08-22.
- Completed plan: [Simplified Architecture Migration Plan](MigrationPlan.md).
- Active plan: [API and Frontend Structure Refactoring](ApiRefactoring.md), phase 4 complete: every feature is `api/`, `model/`, `ui/`, every page mirrors the router, and `axios` appears only in `features/*/api/*.api.ts` and `app/providers.tsx`.
- State: Architecture migration complete. Structure refactoring in progress.
- Current runtime: API, migrations, local fixtures, SyncStart, Realtime, frontend, PostgreSQL, and Redis run without processor or durable-event infrastructure.
- Next action: phase 5, the remaining read models. The HTTP contract changes there, so it is the first phase whose end-to-end tests move with it. `GET /divisions?tournamentId=` becomes `GET /tournaments/:id/standings`, and the statistics page stops downloading the tournament graph.
- Awaiting the user's manual UI check: branches `refactor/4-match-feature`, `refactor/4-division-feature` and `refactor/4-song-feature`, none merged into `main` yet. Each is built on the one before, so they merge in that order; the last carries the `song`, `live`, `auth` and `participant` slices.

## Completed Checkpoints

### Structure refactoring phase 4, closing slices: song, live, auth, participant

- Completed the song slice. `createSong` and `deleteSong` joined `listSongs` in `api/song.api.ts`; the songs list had been requested with a hand-written `axios.get` in four places, each spelling the `tournamentId` query string itself. The bulk import and the pack delete keep their loops, because there is no batch route and per-row results are what lets the import report how many succeeded.
- Completed the live slice as `model/` and `ui/` with no `api/`. The feature reads a websocket and never makes an HTTP request; declaring an empty directory for the rule's sake would have said something untrue about it.
- Completed the auth slice, absorbing `features/admin` and `PermissionContext`. Three `.tsx` files reached the server directly — the account page patched its own profile, the roles page listed accounts and flipped their flags, and the permission context asked for the signed-in account's roles — and are now `useAccountInfoPage`, `useManageRolesPage` and three request modules. `shared/services/` no longer exists: the permission context answers what the signed-in account may do, which is the auth feature's own question. `Account.ts` came out of `features/player/types/`, where it had nothing to do with a player.
- Completed the participant slice, absorbing `player`, `entrant` and `advancement`. None of the three was an area of the application; each was a noun that happened to have a file. `advancement` went to `match` rather than to `participant`: its request and its editor are both about where a match sends its finishers.
- Created `app/providers.tsx`. `main.tsx` configured the axios base URL, the bearer interceptor and the query client inline, which was the last `axios` import in a `.tsx`. The target layout names the file and no phase claimed it.
- Recorded for phase 8: `features/live/model/types.ts` redeclares what the realtime gateway sends, and `apps/realtime` declares the same flattened shape a second time as `LiveMatchState` with `players: unknown[]`. They are not the syncstart contracts — the gateway flattens `song` into `songTitle` and `songPath` — so moving them into the contracts package would have made a phase 4 slice span three workspaces.
- Phase 4 is complete. Seven features, each `api/`, `model/`, `ui/`; every page under `src/pages/` mirroring the router; `axios` only in `features/*/api/*.api.ts` and `app/providers.tsx`; no `.tsx` with a fetching effect; no query key written by hand outside a `*.keys.ts`.
- Verification passed: `npx tsc --noEmit` in the frontend, `npm run build` across every workspace, `npx eslint src` (six pre-existing warnings, none in the changed files), 9 frontend unit tests, `npm run check:architecture`, and the grep rules across the whole tree. No HTTP contract changed. The manual UI check is the user's.

### Structure refactoring phase 4, division slice: frontend api, model, ui

- Split `features/division/` from ten directories into three. `api/` holds `division.api.ts`, `division.keys.ts`, `phase.api.ts` and `phase-group.api.ts`; `model/` holds the hooks, the page context, the pure functions and the view types; `ui/` holds everything that renders.
- Collapsed the four modules under `features/division/types/` into one `model/types.ts`, dropping two exports nothing imported: `GenerateBracketResult` and `PhaseGroupEntrant`.
- Moved the two requests `useDivisionPage` and `useDivisionStandings` spelled with their own `axios.get` into `division.api.ts` as `getDivisionSummary` and `listDivisionStandings`. The feature already had an api module beside those hooks, so a route change would have had to be found in three places.
- Extracted `useDivisionMatchesPage`, which took the match list page from 297 lines to 186 of JSX. It holds state about the page rather than about a match: the scope the tree opened, the pool grouping, and the two search parameters — the open match and the pool advancement editor.
- Made `createDivision` and `renameDivision` answer `void`. They declared a `DivisionSummary` type for a response body neither caller reads, and that name collided with `DivisionSummaryDto`, which is the whole division projection.
- Moved the four division pages to `src/pages/tournament/division/`, mirroring the router, and folded `DivisionLayout` into `DivisionPage`, which is the layout route. The layout held an outlet and nothing else, the same shape `TournamentLayout` had.
- Moved `poolViewMode.ts` to `shared/lib/`, where the target layout puts persisted local state.
- Left `useDivisionStandings` reading into `useState` and refetching on the realtime version counters rather than through the query cache. That is a change of update path, which phase 6 owns; making it here would have put it inside a layout slice.
- Verification passed: `npx tsc --noEmit` in the frontend, `npm run build` across every workspace, `npx eslint src` (six pre-existing warnings, none in the changed files), 9 frontend unit tests, and the grep rules for the feature. No HTTP contract changed. The manual UI check is the user's.

### Structure refactoring phase 4, match slice: frontend api, model, ui

- Split `features/match/` from six directories into three. `api/` holds `match.api.ts` and `match.keys.ts`, which the tournament slice declared and left in `services/`; `model/` holds the hooks, the pure functions and the view types; `ui/` holds everything that renders, with `row/` flattened into it and `bracket/` and `round-robin/` kept. The feature has no pages of its own: `DivisionMatchesPage` hosts it and moves with the division slice.
- Collapsed the five modules under `features/match/types/` into one `model/types.ts`, dropping six re-exports nothing imported: `MatchResult`, `MatchResultPlayerPoints`, `Standing`, `StandingScore`, `StartggReportStatus` and `isHandScored`.
- Replaced the hand-written `Score` interface with the `ScoreDto` the contracts package already carries. It was the eighteenth redeclaration, and phase 3 missed it because that file declared interfaces against `Player` and `Song` rather than re-exporting a name.
- Extracted `useStandingModal`. The standing editor fetched the scores a player already registered from a `useEffect` inside its `.tsx`; the modal is now 152 lines of JSX, and no `.tsx` in the feature fetches.
- Extracted `useAdvancementTargets`. The wider match list the advancement editor needs was fetched in `ConnectedMatchCard` and again in `MatchList`, each spelling the query key and the request by hand inside a `.tsx` — the same class of defect rule 3 exists to close, one layer up. Nothing under `features/match/ui` reaches the server.
- Created `features/song/api/song.api.ts` ahead of the song slice. Two match hooks addressed `songs` with their own `axios.get`, and the resource belongs to the song feature; `listSongs` is declared once and the match hooks ask for the catalog. The song feature's own three copies go when its slice moves its hooks.
- Moved `matches.reducer.ts` and `matches.actions.ts` to `model/` rather than deleting them. Phase 6 owns the removal of the reducer, and dropping it here would have put a change of update path inside a layout slice.
- Left `MatchList` and the two parked views it renders unreferenced, as they were. The decision about where the bracket visualisation is reached from predates this slice and is not a layout question.
- Verification passed: `npx tsc --noEmit` in the frontend, `npm run build` across every workspace, `npx eslint src` (six pre-existing warnings, none in the changed files), `npm run test:contract`, 9 frontend unit tests, and `npm run check:architecture`. No HTTP contract changed. The manual UI check is the user's.

### Structure refactoring phase 4, tournament slice: frontend api, model, ui

- Split `features/tournament/` from seven directories into three. `api/` holds `tournament.api.ts`, `lobbies.api.ts`, `startgg.api.ts` and `tournament.keys.ts`; `model/` holds the hooks, the contexts, the view types and the pure functions; `ui/` holds everything that renders. `axios` now appears in the feature only inside `api/*.api.ts`.
- Collapsed the five modules under `features/tournament/types/` into one `model/types.ts`, dropping twelve re-exports nothing imported: `TournamentOverviewPhase`, `TournamentOverviewDivision`, `TournamentOverviewPlayer` and the start.gg preview sub-shapes.
- Extracted `useTournamentConfigurationPage` and `useTournamentParticipantsPage`, which took the two pages from 362 and 356 lines to 184 and 233 of JSX, and `useTournamentStructureDialogs` and `usePublicTournamentsQuery` for the remaining fetching components. No `.tsx` in the feature fetches.
- Made the public tournament list one shared query. The home page and the search dialog each requested it, so opening the dialog from the home page asked the same question twice.
- Moved the seven tournament pages to `src/pages/tournament/`, mirroring the router and dropping the prefix the directory now carries. `TournamentLayout` folded into `TournamentPage`, which is the layout route.
- Moved `recentTournaments`, `treeState` and `themePreference` to `shared/lib/`, where the target layout puts persisted local state.
- Declared `matches.keys.ts` and `divisions.keys.ts` in this slice rather than in the match and division slices. `["matches", "phase-group", id]` was written by hand in the reader and again in `TournamentUpdatesContext`, which this feature owns: if either had changed, invalidation would have stopped matching with no error and no failing test. Both files stay in `services/` until their own slice moves them into `api/`.
- Put `bracket/bracket-types`, `divisions/:id/generate-bracket` and `matches/scoring-systems` in `divisions.api.ts` and `matches.api.ts` rather than a tournament module: they are called from tournament components but belong to other features. That also removed the second copy of the scoring-system request in the create-match modal.
- The lobby list stopped redeclaring `SyncStartLobbiesDto` and reads the contract instead.
- Verification passed: `npx tsc --noEmit` in the frontend, `npm run build` across every workspace, `npm run lint` (six pre-existing warnings, none in the changed files), `npm run test:contract`, the unit suites in both workspaces, and `npm run check:architecture`. No HTTP contract changed. The manual UI check is the user's.

### Structure refactoring phase 3: shared contracts

- Added the HTTP response contracts to `@tournament-manager/contracts`: `vocabulary.ts` for the closed sets a response branches on, `projections.ts` for the three shapes a competitor is read in, and one file per subject behind the package entry point. Both workspaces now import what only the API used to declare, so removing a field breaks the client at compile time.
- Deleted the five DTO files that held responses under `apps/api/src`: `match-list.dto.ts`, `tournament-overview.dto.ts`, `division-summary.dto.ts`, `division-standings.dto.ts` and `account-profile.dto.ts`. `tournament.dto.ts` and `match.requests.ts` keep only their requests, and the two barrels stop re-exporting what they no longer hold.
- Wrote the entrant projection once in `tournament/shared/projections.ts`. It had four copies — `DivisionManager.findSummary`, `TournamentManager.findOverview` and `toParticipantDto`, and `PhaseGroupManager.toEntrantDto` — mapping into three DTOs that were identical. `MatchQueries` still builds the same JSON in the database, against the field names of the same types, because that is what keeps a list of matches to one query.
- Replaced the frontend's seventeen redeclarations with imports. The shapes already agreed, so eighty-two consumers compiled unchanged; the three disagreements the compiler found were defects, not naming differences.
- Recorded FQ-015 in [FunctionalQuestions.md](FunctionalQuestions.md): the seeding tab sorted the division roster by a `seedNum` the summary projection has never carried, so it has always opened alphabetically. The dead sort key is gone; nothing on screen changes, because it never ran. Phase 5 rewrites that read model and is where the seed would be added.
- Made `CommitMatchResultResponseDto.match` non-optional. It was nullable only because `MatchQueries.byId` is; a commit answers with the match it committed.
- Gave the statistics page its own type. It reads the raw entity dump of `GET /divisions`, four levels deep, and was typed as a division summary; `TournamentStats.ts` states the fields it actually reads and goes when phase 5 replaces that endpoint.
- Two new dependency edges, both recorded in `check-architecture`: contracts on `@tournament-manager/scoring`, so `ScoringSystemType` stays declared once, and the frontend on contracts. Scoring has no dependencies of its own and now builds first. The unions the persistence entities own were not taken the same way — the browser must not depend on TypeORM, so contracts declares them and the API's projections are checked against them where they map a row.
- `SongDto`, `ScoreDto` and `PlayerRefDto` describe routes that still answer with entities, so nothing on the API asserts them yet. They state what the interface reads; phase 5 makes the API produce them.
- `tournament.dto.ts` was emptied but not moved: phase 8 already claims the move of what remains, which is a request DTO, together with the barrel that re-exports it.
- Verification passed: `npx tsc --noEmit` in both workspaces, `npm run build` across every workspace, `npm run lint` (four pre-existing warnings in the API and six in the frontend, none in the changed files), `npm run test:contract`, 126 unit tests, 27 end-to-end tests against PostgreSQL, and `npm run check:architecture`. No behaviour changed and the wire is unchanged: `closedAt` is now projected with `toISOString()`, which is the string `Date.toJSON` already produced.

### Structure refactoring phase 2: match directory layout

- Made the layout rule explicit in [ApiRefactoring.md](ApiRefactoring.md): every phase leaves the files it touched in the target position, with a kebab-case name and camelCase methods, as its last commit once verification has passed. It was previously stated only inside phase 7, so phases 2 and 3 did not apply it and the file names under `bracket/`, the barrels and `shared/` belonged to no phase at all.
- Added phase 8 for what no aggregate can carry: the `bracket/` renames, the four barrels, `shared/`, the `catalog/` move, and mirroring `tests/unit`. Freeze became phase 9.
- Moved the match aggregate into its target layout: `controllers/matches.controller.ts` to `match.controller.ts`, `dtos/match.dto.ts` to `match.requests.ts`, `dtos/match-list.dto.ts` up one level, and `competition/standing/` into `competition/match/` as `rounds.controller.ts` and `rounds.requests.ts`. `competition/match/controllers/`, `competition/match/dtos/` and `competition/standing/` no longer exist; a round is a match being scored, not a directory of its own.
- Phase 2 had deferred these moves to avoid making them twice. That held for one file of five: phase 3 relocates none of the four others, and it deletes `match-list.dto.ts` rather than moving it again.
- `competition/match/services/` still holds the publisher, the context service and the advancement manager. None of the three belongs to the match aggregate in the target tree; they move in phases 7 and 8.
- Verification passed: `npx tsc --noEmit`, `npm run build`, `npm run lint` (the four pre-existing warnings), 70 unit tests, 26 end-to-end tests against PostgreSQL, and `npm run check:architecture`. No behaviour changed: the commit is moves and import rewrites only.

### Structure refactoring phase 2: match write side

- Added `competition/match/match.aggregate.ts`, `match.store.ts` and `match.commands.ts`. The aggregate holds the rules and takes no dependencies, the store holds the one graph definition and the one transaction that puts it back, and the commands hold the order of the steps: load once, change in memory, save once, publish once.
- Removed `MatchManager`, `MatchWorkflowManager`, `StandingManager`, `MatchResultService`, `RoundService`, `StandingService` and `MatchService`, about 900 lines in which each layer reloaded what its caller already held. Nothing now sits between a controller and the match.
- Committing a result read the match graph five times: in the workflow manager, for the pool, again after the commit, inside the start.gg reporter, and once more to answer. It reads it once. Writing one score read it twice and now reads it once. The last case of the new end-to-end suite counts those loads, so a reload put back between the steps of a write fails a test.
- The store's graph reaches the tournament, so a write publishes an address it already holds. `UiUpdateContextService` lost its match lookup and the publisher gained `emitMatchUpdate` and `emitPhaseGroupUpdate`. The rest of the context service still serves the aggregates that have no store yet; deleting it outright, as phase 2 was first written, would have meant giving each of them a lookup of its own.
- The rules moved into the aggregate, where they are testable without a database: what a completed match refuses, when a round may carry a song, when a round is settled, the points a commit writes, and how a standing is written and ranked. The two mock-driven manager specs became one aggregate spec of thirty cases, and the advancement spec now asserts on saved aggregates rather than on calls to a service.
- `POST /matches` and `PATCH /matches/:id` answer with `MatchQueries.byId` like every other mutation. They used to answer with a bare entity carrying neither `advancementRules` nor `phaseGroupId`, while the client already declared it was reading a projection.
- Four departures from the plan, each recorded in [ApiRefactoring.md](ApiRefactoring.md): `applyCompletedSong` stays in `CompletedSongService` until the `syncstart/` split, `addEntrant` and `removeEntrant` are commands because the bracket systems need them, `MatchQueries` took in the two reads stranded in `MatchService` (`pendingCountsByPhaseGroup` and `exists`), and the file moves wait for phase 3 rather than being made twice.
- Recorded FQ-014 in [FunctionalQuestions.md](FunctionalQuestions.md): advancement writes entrants into a target match that already holds a result, while every edit a person makes is refused. The behaviour predates the aggregate and was kept.
- Verification passed: `npx tsc --noEmit`, `npm run build`, `npm run lint` (the four pre-existing warnings, none in the changed files), 70 unit tests, 26 end-to-end tests against PostgreSQL, and `npm run check:architecture`.

### Structure refactoring phase 1: match read side

- Added `competition/match/match.queries.ts` with `byId`, `byPhaseGroup` and `byDivision`. The three differ in one predicate and share one query, one mapper and one batched advancement-rule lookup, so a read costs two queries whatever the size of its scope. The per-match form issued two rule lookups inside the map over a pool's matches, which cost `1 + 2N` queries: 81 for a forty-match pool, 5 for the two-match pool the new test reads.
- Aggregated both child collections into JSON in the database, so one match is one row. A flat join would multiply entrants by standings and move the grouping back into JavaScript; the JSON keys are the DTO field names, which keeps the mapper a copy rather than a translation.
- Pointed `GET /matches/:id`, `GET /matches/division/:id` and `GET /matches/phase-group/:id` at it, and made `MatchManager.GetMatchForView` delegate to `byId`. Every write that answers with a match now returns the projection its `GET` returns, so a match is described in one place. `MatchManager` keeps the write paths, which phase 2 moves.
- Removed `MatchManager.toMatchListDto`, `FindMatchesForDivision`, `FindMatchesForPhaseGroup`, `MatchService.findByDivisionForView` and `findByPhaseGroupForView`. `findOneForView` stays: the write paths still load their match through it.
- Added `tests/e2e/competition/match-reads.e2e-spec.ts`, six cases against a real PostgreSQL, covering an entrant with a participant and a player, a played round with a score, a hand-scored round without one, a rule leaving one match and reaching another, a second pool only the division scope sees, and the query count of a pool read. Raw SQL is not checked by the compiler, so this suite is the safety net a renamed column has to fail against.
- Verification passed: `npx tsc --noEmit`, `npm run build` (every workspace), `npm run lint` (the four pre-existing warnings, none in the changed files), 57 unit tests, 17 end-to-end tests against PostgreSQL, and `npm run check:architecture`.

### Structure refactoring phase 0: removals

- Recorded the refactoring plan in [ApiRefactoring.md](ApiRefactoring.md): questions and commands separated, four roles per aggregate, one aggregate load per command, two database access styles chosen by a rule, and the target directory layout for both workspaces.
- Deleted six unreferenced files under `src/tournament`, 694 lines. `accountplayer.dto.ts` was the largest file in the directory and duplicated `account/dtos/accountplayer.dto.ts`, which is the one the account controller imports. `pad.roller.ts` was never a registered provider, which left `match_assignment.dto.ts` with no consumer. The `MatchAssignment` entity is unaffected.
- Removed three read routes no client calls, with the service and manager methods that existed only to serve them: `GET /divisions/:id`, `GET /phase-groups/:id`, and `GET /phases/:phaseId/phase-groups`. This also removed `DivisionService.findOneForView`, the heaviest relations tree in the structure services.
- Kept `GET /phase-groups/:id/entrants` despite having no client. Its end-to-end test is the only coverage of derived pool membership, which phases 2 and 7 refactor; it is removed in phase 7.
- Verification passed: `npm run build`, `npm run lint` (four pre-existing warnings, none in the changed files), 57 unit tests, 11 end-to-end tests against PostgreSQL, and `npm run check:architecture`.

### Hosted-target preparation and local replica contract

- Added `REDIS_URL` support to the Redis transport through `resolveRedisEndpoint` and `createRedisClient`. A hosted instance can now supply credentials and TLS in one connection string, while the local stack keeps `REDIS_HOST` and `REDIS_PORT` unchanged.
- Routed the API, SyncStart, and Realtime Redis readiness probes through the same resolver so they follow the configured endpoint instead of the discrete host and port only. The probe still speaks plaintext `PING` over a raw socket; moving it to an authenticated client call remains open in [Hosting Options](HostingOptions.md).
- Made the two local realtime replicas an enforced contract: `check-architecture` now fails when the root Compose configuration defines fewer than two, and [Local Operations](LocalOperations.md) records that they verify replica convergence rather than provide capacity.
- Verification passed: `npm run check:architecture`, `npm run build`, `npm run lint` (pre-existing warnings only), and `npm run test:unit` across every workspace.

### SyncStart startup reconciliation

- Made SyncStart reconstruct its own tournament runtimes at startup through `TournamentBootstrapService`, which consumes the previously unused `GET /internal/syncstart/tournaments` endpoint on the API.
- Closed the restart gap: `TournamentSyncStartBootstrap` only pushes configuration when the API starts, so a SyncStart-only restart left every configured tournament without a runtime until an operator saved or reopened the tournament.
- Kept reconciliation off the readiness path. The API is still starting while SyncStart becomes healthy in the local topology, so a failed attempt retries in the background with an unreferenced timer that stops on shutdown.
- Added `TournamentSyncStartRegistry.ensureConfigured`, which creates a runtime only for a tournament that has none, so reconciliation cannot tear down a live protocol connection.
- Verification passed: `npm run lint --workspace=@tournament-manager/syncstart`, `npm run test --workspace=@tournament-manager/syncstart -- --runInBand` (7 suites, 25 tests), `npm run build --workspace=@tournament-manager/syncstart`, and `npm run check:architecture`.

### Authentication unification and administrator bootstrap

- Resolved FQ-004. Removed the synthetic `local-admin` identity, which was not a database row and made `TournamentService.getMyRoles` fail with a PostgreSQL uuid cast error; the frontend permission context swallowed that failure and hid every tournament editing control.
- Replaced API-key authentication with a seeded administrator account. `apps/migrations` now seeds an account from `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD` after applying migrations, creating it only when no account with that username exists. Local runs read the repository-root `.env`; deployed runs read deployment secrets.
- Removed `AuthService.loginWithApiKey`, `POST /auth/login/local`, `LocalApiKeyLoginDto`, both `local-admin` branches, and the `AUTH_MODE` registration gate. `POST /auth/login` is the only authentication path in every environment.
- Removed the unreferenced `Role` enum, `RolesGuard`, and `Roles` decorator. Authorization keeps the two models actually in use: global `isAdmin`/`isTournamentCreator` account flags and per-tournament `Participant.roles`.
- Removed the frontend `isLocalMode` deployment switch, the `authMode` runtime-config field, `VITE_AUTH_MODE`, `PUBLIC_AUTH_MODE`, and the split `local`/`web` start and build scripts.
- Fixed `AuthService.validateUser`, which dereferenced a missing account and returned HTTP 500 instead of 401 for an unknown username.
- Verification passed: architecture check, all workspace builds, lint (pre-existing warnings only, no errors), and all workspace unit suites including a new regression test for unknown-username login.

### API feature-first directory organization

- Split the former all-purpose tournament controller into focused tournament lifecycle, participant management, lobby control, and Start.gg import controllers without changing public routes.
- Replaced the aggregate controller and service barrels with explicit `TournamentModule` composition, keeping the existing manager names and application behavior unchanged.
- Grouped division, phase, phase-group, and advancement-rule code under `tournament/structure`; grouped match, bracket, standing, score, round, song, and completed-song code under `tournament/competition`; and co-located the SyncStart port, HTTP adapter, module, bootstrap, service, and lobby controller under `tournament/syncstart`.
- Mirrored the capability structure under unit tests and separated API e2e and integration suites into dedicated directories.
- Focused verification passed: API build; 11 unit suites with 34 tests; 4 e2e suites with 11 tests; one integration suite with 2 tests; and API lint with the nine pre-existing warnings and no errors.

### API-to-SyncStart client boundary refinement

- Replaced the stateless `LobbyManager` transport bridge with a transport-neutral `SyncStartClient` port, module-selected `HttpSyncStartClient` adapter, and application-facing `TournamentSyncStartService`.
- Moved route selection, authentication, timeout handling, response decoding, and gateway-error mapping into the HTTP adapter; controllers now invoke the application service and do not know the concrete transport.
- Isolated persisted tournament reconciliation in `TournamentSyncStartBootstrap`, preserving the existing API startup behavior without assigning lobby or connection state to the API.
- Added focused unit coverage for application delegation and normalization, HTTP routing and failure mapping, and startup reconciliation.
- Verification passed with `npm run verify`: architecture boundaries, all workspace builds, lint with pre-existing warnings only, contract tests, all workspace unit tests, 11 API e2e tests, and the migration-runner e2e test.

### Deployment maintenance-window decision

- Recorded that every deployment blocks user access to the complete platform until the new or rolled-back release passes readiness and smoke checks.
- Removed zero-downtime, rolling cross-version compatibility, and live SyncStart connection handoff from the deployment requirements. PostgreSQL and Redis may remain available for migration and recovery while application traffic is blocked.
- Kept the external traffic-blocking mechanism as an operational edge decision because the reverse proxy and tunnel are outside the application contract.

### SyncStart scalable ownership refinement

- Bound each configured tournament to a replica-local `TournamentSyncStartRuntime` containing its protocol client, application observers, and focused lobby catalog; the registry now performs only creation, lookup, replacement, delegation, and shutdown.
- Extracted `SyncStartServerSession` to own server connection status and lobby-search correlation, and moved lobby handshake, identity, pending connection, message interpretation, transition dispatch, and transport lifecycle fully behind `LobbySession`.
- Bound `SyncStartClient` to one `tournamentId`, removed direct mutation of session state, propagated the injected WebSocket factory to every server and lobby connection, and registered the client factory through an explicit NestJS token.
- Kept SyncStart deliberately single-replica while documenting the future horizontal rule: one logical owner per `tournamentId`, with distributed assignment and failover deferred until required.
- Replaced static readiness with a real Redis probe and added focused runtime, catalog, session ownership, factory, lifecycle, and health tests.
- Verification passed: production NestJS module bootstrap and shutdown; full workspace build and lint (existing warnings only); all workspace unit tests; 3 SyncStart protocol suites with 6 tests; 6 SyncStart application suites with 20 tests; and repository architecture-boundary checks.

### Realtime object-ownership refactoring

- Replaced the monolithic `RealtimeGateway` with `RealtimeEventService`, `WebSocketBrowserEventBroadcaster`, `TournamentRealtimeRegistry`, and one focused `TournamentRealtimeState` per observed tournament and replica.
- Kept browser message mapping pure, moved WebSocket lifecycle and scoped connections behind `BrowserEventBroadcaster`, and moved replaceable sequence, snapshot, lobby cleanup, and live-match transitions into their state owner.
- Preserved multi-replica Redis Pub/Sub fan-out without shared state, client affinity, locks, or additional persistence. Optional incoming sequences are resolved without mutating subscribed envelopes.
- Added isolated coverage for mapping, sequencing, snapshot replacement, live-match transitions, lobby cleanup, replica convergence, event routing, WebSocket validation and scoping, initial recovery messages, and lifecycle shutdown.
- Verification passed: full workspace build and lint (existing warnings only), all workspace unit tests, 4 Realtime unit suites with 16 tests, and repository architecture-boundary checks.

### Object-oriented ownership design rule

- Recorded the SyncStart ownership model as the default for new backend development: stateful concepts own their state and transitions, while coordinators own composition and lifecycle coordination.
- Kept ownership as the default class-design model and made scalability a conditional assessment: when an ownership boundary affects required scaling, its scope must support the necessary replication or partitioning without introducing premature distributed coordination.
- Existing components are evaluated for incremental adoption when touched; the rule does not mandate unrelated rewrites or class wrappers around stateless pure functions.

### Backend internal HTTP client standard

- Recorded the approved standard for backend-to-backend HTTP: NestJS `HttpModule`, injected `HttpService`, and `firstValueFrom`; direct global `fetch` calls are not used by application-owned HTTP adapters.

### SyncStart outbound HTTP adapter

- Replaced the direct global `fetch` call in `CompletedSongSubmitter` with injected NestJS `HttpService`; the application module imports `HttpModule` for runtime wiring and the existing unit test now mocks the injectable client.
- Verification passed: `npm run lint --workspace=@tournament-manager/syncstart`, `npm run test --workspace=@tournament-manager/syncstart -- --runInBand` (5 suites, 16 tests), and `npm run build --workspace=@tournament-manager/syncstart`.

### SyncStart application unit-test coverage

- Added isolated unit tests for `TournamentSyncStartRegistry`, `InternalController` delegation, `SyncStartEventsPublisher`, `CompletedSongSubmitter`, and lifecycle cleanup in `LobbyCatalog`; no Nest module test or production-code change was required.
- Verification passed: `npm run lint --workspace=@tournament-manager/syncstart` and `npm run test --workspace=@tournament-manager/syncstart -- --runInBand` (5 suites, 16 tests).

### SyncStart refactoring completion

- Extracted `LobbyStateInterpreter` and `LobbySession` from `SyncStartClient`; normalized state transitions and completion de-duplication are now unit-testable without a WebSocket.
- Added injectable WebSocket and SyncStart-client factories, clean protocol/application/simulator builds, and an architecture guard for simulator isolation.
- Verification passed: `npm run lint --workspace=@tournament-manager/syncstart-protocol`, `npm run build --workspace=@tournament-manager/syncstart-protocol`, `npm run lint --workspace=@tournament-manager/syncstart`, `npm run test --workspace=@tournament-manager/syncstart-protocol -- --runInBand`, `npm run test --workspace=@tournament-manager/syncstart -- --runInBand`, and `npm run check:architecture`.

### SyncStart protocol package and session ownership refinement

- Created `@tournament-manager/syncstart-protocol` and moved the external SyncStart WebSocket connector, transport primitives, protocol types, and deterministic simulator from the SyncStart application into it.
- Replaced the command-switching `SyncStartSessionManager` with `TournamentSyncStartRegistry`, which owns one protocol client per configured tournament and exposes the direct operations used by the internal controller.
- Extracted `LobbyCatalog` as the volatile projection of observed lobby metadata. It is updated through protocol events and merges local metadata with remote lobby-search results without owning connections.
- Updated the SyncStart image build order, workspace metadata, architecture documentation, and protocol unit-test ownership.
- Verification passed: `npm run build --workspace=@tournament-manager/contracts`, `npm run build --workspace=@tournament-manager/syncstart-protocol`, `npm run build --workspace=@tournament-manager/syncstart`, `npm run test --workspace=@tournament-manager/syncstart-protocol`, and `npm run lint --workspace=@tournament-manager/syncstart`.

### Scoring package boundary cleanup

- Renamed the generic `@tournament-manager/application` workspace to `@tournament-manager/scoring` and split its former barrel implementation into focused scoring interfaces, calculators, identifier types, and provider files.
- Made `ScoringSystemType` and `SCORING_SYSTEM_TYPES` the canonical scoring identifiers. Persistence entity fields and API DTOs now use the type, while request validation and OpenAPI metadata use the runtime identifier list.
- Kept bracket implementations and `BracketSystemProvider` inside the API because they directly orchestrate API services and persistence. The currently selected bracket type remains persisted on each phase group and is consumed by API and frontend behavior.
- Updated workspace dependency rules, Docker builds, and architecture documentation for the new package boundary.
- Verification passed: `npm run build`, `npm run lint` (existing warnings only), `npm test --workspace=@tournament-manager/api -- --runInBand` (8 suites, 26 tests), `npm run check:architecture`, and a clean build of `apps/migrations/Dockerfile`.

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

### Live messaging boundary refinement

- Moved generic event envelopes and their validation from `@tournament-manager/contracts` into `@tournament-manager/live-messaging`. Contracts now contain only SyncStart DTOs and internal HTTP request contracts.
- Defined `EventEnvelope`, `IdentifiedEventEnvelope`, and `SequencedLiveEventEnvelope` around the shared tournament scope; completed-song processing uses the identified variant for idempotency.
- Organized Redis adapters under `transports/redis` and added `InMemoryLiveEventTransport`, which implements both publisher and subscriber ports for Redis-free tests.
- Updated application imports, package dependencies, architecture documentation, and envelope/in-memory transport tests.
- Verification passed: builds and type lint for contracts, live-messaging, API, SyncStart, and Realtime; `npm run test:contract`; and `npm run test:unit` (all workspace unit suites passed). API lint completed with its nine pre-existing warnings and no errors.

### Frontend navigation rebuilt around the tournament tree

- Replaced four overlapping navigation systems — the sidebar tab list, the tournament header create menus, the division tab bar, and the phase breadcrumb with its pool chips — with one tournament tree in the sidebar.
- Mounted `TournamentUpdatesProvider` and the new `TournamentTreeProvider` in `MainLayout`, above both the sidebar and the page outlet, so the tree's status glyphs follow the same realtime events the pages do. Tournament structure and every operation that changes it now belong to that provider alone; `useTournamentPage` keeps only the tournament's own properties.
- Made every node an address: `division/:divisionId`, `.../phase/:phaseId`, and `.../phase/:phaseId/pool/:poolId` open one flat match list at different depths, with the open match carried as `?match=` and a pool's advancement rules as `?edit=advancement`.
- Added the flat match list: pools grouped under sticky headers, its own scroll with the card anchored below, and search over match, player, song, pool and phase names across the whole division.
- Gave each match row two independent axes in fixed positions — the active dot on the left, the commit state on the right — instead of one combined status.
- Added a shared `ContextMenu` with right click on desktop, a visible overflow button, and a long press on touch; structural creation, renaming and deletion moved there from the page header.
- Tree icons stay neutral; colour on a node reports only rolled-up state (`running` outranks `pending`, and a branch is `done` only when every child is). Selection stays greyscale, per `.ai/Design.md`.
- Made the sidebar resizable, replaced the mobile drawer with a `/browse` page, and persisted tree expansion, recents and pinned tournaments in localStorage.
- Moved the workspace totals from Overview into Stats and left Overview as a deliberate placeholder. Division entrants, seeding and standings stay tree leaves for now; merging them into a tournament-level Roster page is the next step and was staged last on purpose so nothing breaks in between.
- Retired `DivisionPhasesPage`, `BracketsTab`, `PhaseBreadcrumb`, `PhaseGroupSelector`, `PhaseMatchesPanel`, `PhaseGroupContent`, `PhaseActionsMenu`, `RenamePhaseModal`, `useBracketsTab`, `usePhaseGroupActions`, `TournamentManagementModals`, `TournamentHeaderCreateMenu`, `tournamentHeaderSubtitle`, both tab configs, `useTournamentLayout`, `SidebarContext`, `TournamentOverviewDivisions`, `DivisionCard`, `useTournamentOverviewPage`, `CreateChip`, and `phaseMatchCount`.
- Left `MatchList` and the bracket and round-robin views in place but unwired: the bracket visualisation is parked, not dropped, and needs a decision about where it is reached from.
- Verification: `npx tsc --noEmit` clean, `npx eslint src` zero errors (six pre-existing fast-refresh warnings), `npx vite build` succeeds, and `npm test` passes with the header-subtitle suite replaced by a `parseTreeSelection` suite covering every tree depth.
- Not done, and needing approval before it is: the pool status glyph cannot report "awaiting confirmation" because the overview payload carries no per-pool count of matches pending a commit. It currently maps `pending | active | completed` straight through.

### Match card actions and hand scoring

- Replaced the hover-revealed add strips with two affordances that never overlap: an empty match renders a skeleton table with a dashed song column and a dashed player row, and a match with content carries neutral `+ Player` and `+ Song` buttons in its header. The dash keeps its meaning of an empty slot to fill, so the header buttons are not dashed. The `sm:hidden` duplicates in the match actions menu are gone.
- Made hand scoring an explicit per-match choice in the actions menu instead of a state a match fell into by having no songs, and persisted the choice and its points in `localStorage`, so closing a tab no longer discards a draft. The card says plainly that the points stay on the device until commit. Recorded as FQ-012 whether the draft should instead be shared.
- Replaced the disabled commit button with the precondition it is waiting on — "3 scores missing", "No songs yet", "No points assigned" — computed by `getCommitBlocker` from the same progress function the badge uses.
- Themed form controls in the base layer and declared `color-scheme` per theme; inputs across every modal were keeping the user agent's white background.
- Gave a match row two independent axes: `active` on the left, four-step result progress on the right. `getMatchProgress` is the single source and `getMatchCommitState` derives from it.
- An active match's status glyph breathes, wrapped in `motion-safe`. It is the only animated state in the application, and `.ai/Design.md` records that as a rule.
- Verification: `npx tsc --noEmit` clean, `npx eslint src` zero errors, `npx vite build` succeeds, `npm test` 5/5.

### Match state moved to the list row

- Moved the progress badge, the commit precondition and the commit button out of the match card and onto the list row: the row owns the state of a match, the card owns its contents. The row's right-hand slot has three faces — what is missing, the commit button once nothing is, then the completed badge.
- Rebuilt the row as a div holding a select button rather than one button, since a commit button nested inside it was neither valid HTML nor keyboard reachable.
- Made the hand-scoring store observable and cached, so the list can see a draft the card is writing; without it a match being scored by hand read as empty in the list. `buildCommitRequest` is shared, so the row and any future caller send the same shape.
- The card header now carries only add player, add song and the overflow menu.
- `MatchCard` no longer takes `onCommitMatchResult`. The parked bracket and round-robin views render cards, so re-wiring them will need a commit affordance of their own.
- Verification: `npx tsc --noEmit` clean, `npx eslint src` zero errors, `npx vite build` succeeds, `npm test` 5/5.

### Connecting is the realtime snapshot

- Moved the cached state into the `RealtimeReady` frame the server opens every connection with, so a client learns the sequence and what it missed in one frame. It used to receive the two separately and could not tell a first connection from a reconnection with a gap, which is why it re-fetched the same snapshot over HTTP on every page load.
- Deleted `SnapshotController` and `GET /realtime/snapshot`; nothing calls it now that the ready frame carries the state. `RealtimeSnapshotReader` stays, because the broadcaster fills that frame through it.
- Replayed messages now reach a consumer marked as such. `TournamentUpdatesProvider` ignores them: on `/uiupdatehub` they are only invalidation signals, and acting on history refetched the whole tournament on load and raised warning toasts that were already old.
- Restricted the authoritative recovery to a socket that resumes at a sequence it has not seen. The invalidation it triggers stays unfiltered, because the query keys are scoped to divisions and pools rather than to a tournament.
- Split the effect in `useTournamentPage`, which refetched the tournament whenever `canControl` flipped as permissions resolved.
- Result on a pool page load: one `overview` request instead of three, and no snapshot fetches.
- Open question recorded as FQ-013: a change committed between the HTTP read and the socket connection is announced by a signal the client now discards.
- Verification: `npm run check:architecture` passes, realtime `tsc --noEmit` clean and 16/16 unit tests, API `tsc --noEmit` clean with tests included, realtime e2e 2/2 against a real Redis, frontend `vite build` and `eslint` clean.

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
