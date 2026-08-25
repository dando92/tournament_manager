# Migration Execution Status

## Current Position

- Last updated: 2026-08-25.
- Completed plans: [Simplified Architecture Migration Plan](MigrationPlan.md), [API and Frontend Structure Refactoring](ApiRefactoring.md), and [Control Room](ControlRoom.md).
- Active plan: none.
- State: Architecture migration and Control Room delivery complete.
- Current runtime: API, migrations, local fixtures, SyncStart, Realtime, frontend, PostgreSQL, and Redis run without processor or durable-event infrastructure.
- Next action: manually exercise the responsive Control Room carousel, queue long-press menu, flow editor drag-and-drop, and real lobby/cabinet sessions with two concurrent flows.

### Tournament overview timeline

- Added atomic flow creation through a modal that captures the name, planned
  start, default duration, initial match assignment, and order. The inactive
  editor remains available and now preserves per-entry timing data on reorder.
- Added persisted expected durations and actual entry start/completion times;
  planned and estimated starts and the global live offset remain derived.
- Populated Tournament Overview with read-only match cards, synchronized
  timeline/card dragging, distinct current and selected states, responsive
  neighboring-card previews, a full-height right flow sidebar on desktop, and
  explicit mobile flow controls below the horizontal match carousel. The mobile
  overview removes nested table scrolling so the whole card drags consistently.
- Added the focused Control Room `Edit time` action without realtime broadcast.
- Added a forward timing migration for databases that already ran the original
  Control Room migrations. Existing flows are preserved with a migration-time
  planned start and 30-minute entry durations; fresh databases run the same
  sequence and require no special reset.
- Verification: contracts, persistence, API, migrations, and frontend builds
  pass; 137 API unit tests and 53 frontend unit tests pass. Both migration
  end-to-end cases pass, including an upgrade from the previous Control Room
  schema, and all six Control Room API end-to-end scenarios pass. The forward
  migration was applied to the local database and the flow endpoint returned
  HTTP 200 with the preserved flows and backfilled timing fields.
- Latest responsive follow-up verification: frontend build and lint pass with
  the five existing warnings and no errors; `git diff --check` reports no
  whitespace errors.
- Manual UI check: the user confirmed the division entrants page on 2026-08-23, after the withdrawn-entrant fix. That covers `fix/withdrawn-entrants` and the division half of `feature/division-pages` and `refactor/5-tree`. Not yet confirmed by hand: the home page and the search dialog on the two-field public list, the participants page and the start.gg import preview, the song list, the new song import dialog, and the rebuilt create-match modal.

## Completed Checkpoints

### Control Room interaction and application configuration follow-up

- Ordinary Control Room Start now reevaluates from the queue head, while the
  explicit Start from here action retains its selected entry.
- Reworked the Control Room into a borderless full-width flow carousel with
  touch swipe, resisted edge movement, and up to five centred navigation dots
  supporting click, hover, wheel, and trackpad interaction. Queue rows select
  the detail card, reuse match progress and Commit controls, mark the current
  step, and expose their context menu through touch long press.
- Moved the independent lobby control below the carousel. Reworked the inactive
  flow editor so whole rows drag within and between Flow order and Unassigned,
  including reliable dragging across the modal boundary and a drag preview that
  remains visible above the modal overlay.
- Added a Tournament Manager configuration destination for device theme and
  administrator role management, redirected the former role-management route,
  and aligned desktop and mobile navigation/account actions with it.
- Verification: the frontend build passes, all 51 frontend unit tests pass,
  frontend lint has the five existing warnings and no errors, the focused
  Control Room aggregate suite passes all six tests, and `git diff --check`
  reports no whitespace errors.
- Next action: manually verify the responsive gestures and configuration page
  with authenticated staff and administrator sessions.

### Tournament Control Room

Requested by the user on 2026-08-24, after the legacy lobby-control checkpoint.

- Added PostgreSQL-authoritative tournament flows with persisted unique match assignment, ordering, cursor, lifecycle, stale diagnosis, archive visibility, and optimistic editor versioning. The row-locked synchronous runner advances ready-to-commit matches without committing them, keeps blocked flows running and stale, and reconciles running flows at API startup.
- Added Start, Start from here, Pause, Resume, Stop, Archive, Unarchive, editor, and query endpoints. Relevant match, standing, song, entrant, advancement, commit, reopen, deletion, and tournament lifecycle writes recalculate affected flows. Manual match activation is refused while a tournament flow is running or paused.
- Added backend-enforced rollback confirmation. A confirmed rollback stops the affected running or paused flow, deactivates its current match, and then applies the mutation. A confirmed completed-flow result reopen disarchives the flow, returns it to inactive at that match, and records the interruption. Reopen is refused when an affected advancement target already has scores or a committed result. Closing a tournament stops operational flows; reopening does not restart them.
- Added the tournament-level Control Room frontend with multiple flow panels, current match cards, queue context actions, stale explanations, persisted drag-and-drop ordering with keyboard controls, Unassigned only inside the inactive editor, and completed-flow archive visibility.
- Moved the independent lobby-control card into each operational flow panel without creating a lobby-to-flow or lobby-to-match binding. Restored the live panel below division match cards for staff and viewers.
- Renamed and finalized [ControlRoom.md](ControlRoom.md), synchronized backend, frontend, and design decisions, and resolved FQ-027.
- Verification: `npm run verify` passes. This covers architecture checks, all workspace builds, lint with the six existing warnings only, contracts, 136 API unit tests, 105 API end-to-end tests, and the migration-runner end-to-end test. The Control Room end-to-end suite covers no-commit advancement and manual activation protection, stale recovery, pause/resume/completion/archive, concurrent independent flows, confirmed rollback shutdown, completed-flow reopening, and progress protection for both match and pool advancement targets.
- Next action: manually verify the responsive Control Room, drag-and-drop editor, context menu, and real lobby controls with multiple cabinets.

### Talking to legacy ITGmania cabinets

Requested by the user on 2026-08-23, outside the phase sequence.

- Added `tools/legacy-syncstart-bridge`: a compatibility adapter that listens to the legacy UDP broadcast on port `53000` and answers Tournament Manager as a SyncStart server, so a tournament can be run on ITGmania builds that predate the WebSocket protocol. It is a tool and not an application: it is not part of the hosted stack, it depends on no workspace, and `check:architecture` holds it independent from `@tournament-manager/syncstart-protocol` the way it holds the simulator.
- What the application actually reads was verified before anything was written, and two of the answers changed the design. `exScore` is the run — `CompletedSongService` records `percentage: score.exScore` and refuses a score without it — and `screenName` is load-bearing: `LobbyStateInterpreter` reports a completed song only when a player it last saw on `ScreenGameplay` appears on an evaluation screen. The earlier JavaScript prototype published a final score alone, with no gameplay snapshot before it, so nothing it ever sent could have been recorded as a standing.
- A completed song is therefore published as two snapshots, gameplay then evaluation, and only once every player the session saw has sent a final message. A snapshot that turned one player to evaluation while the other was still playing would record the second player's half-finished run and record it again when they finished, because a completion carries every player in the snapshot.
- The song identifier needs no translation: the cabinet reports `Pack/SongFolder` and the folder importer stores that as a song's title, which is what `SONG_OF_TOURNAMENT_BY_TITLE` compares `songPath` against.
- `npm run local_sync:up` starts the detached local Compose stack and then runs the legacy bridge on the host, where LAN broadcast is reliable. The fixture is left alone: the tournament's SyncStart URL is set to `ws://host.docker.internal:1337` by hand. `npm run local_sync:bridge` runs only the host bridge when the stack is already running; `docker-compose.legacy-bridge.yml` remains available for deployments whose container networking delivers LAN broadcast.
- Recorded two behaviours rather than deciding them: a legacy cabinet has no EX score and reports the dance-point percentage that is stored in its place (FQ-025), and its hold total includes rolls because the wire never separates them (FQ-026).
- Verification: `npm run check:architecture`, `npm run build` across every workspace, `npm run lint` (pre-existing warnings only), 33 new unit tests over the parser, the score and judgment mapping, the session state machine and the WebSocket contract, and the full `npm run test:unit` suite. The image builds, and a container with `53000/udp` published turned a song, a live score and a final score into the gameplay and evaluation snapshots a standing needs — over unicast and over `255.255.255.255` from this host.
- Not yet confirmed by hand: a real legacy cabinet on the venue LAN. Broadcast delivery from another machine, through the host firewall and the Docker port forwarder, is the one property no test here can stand in for.

### Choosing where a match is created

Requested by the user on 2026-08-23, outside the phase sequence.

- Replaced the three dependent dropdowns of the create-match modal with one destination, drawn as the path it is: `Division / Phase / Pool`. The rules live in `apps/frontend/src/shared/components/ui/cascadingPath.ts` and are pure — a level offers what its ancestors allow, choosing a level clears what is below it, a value no longer among its options is dropped, and a level with exactly one option settles itself and lets the next one settle in turn.
- The modal no longer keeps a division, a phase and a pool in step with three effects, and no longer defaults to the first pool it finds. It holds the path, derives completeness from it with `isCompleteMatchPath`, and holds the Create button closed until the path reaches a pool. The structure comes from `TournamentTreeProvider` rather than from props, so `CreateMatchScopeFields` and `MatchPhaseOption` are gone.
- The picker is generic and depth-agnostic, so a second hierarchical selector does not need a second implementation. It scrolls sideways with faded ends on a narrow screen, and its options panel is positioned inside the picker rather than portalled, because it has to escape the horizontal scroller and not the dialog.
- Verification passed: `npm run build` and `npm run lint` for the frontend (pre-existing warnings only), and 48 frontend unit tests including 11 new ones over the path rules.
- Not yet confirmed by hand: the modal itself. Recorded as [FQ-024](FunctionalQuestions.md).

### Importing songs from a folder

Requested by the user on 2026-08-23, outside the phase sequence.

- Replaced the JSON song import with a directory importer. The person picks their ITGmania `Songs` folder — or one pack — in the browser, and the discovery and parsing rules of `itgmania-songs-to-json.mjs` now live in `apps/frontend/src/features/song/model/songImport/`: pack detection, hidden folders, `.ssc` over `.sm`, `dance-single` only, and `highest` meaning the highest meter. The parser takes text and gives values, so it is tested from raw simfile strings; the scan takes directory handles, so it is tested from plain objects.
- The browser owns the folder the person granted, so it does the reading. The API is sent one payload of charts, validates every row, and writes them in one transaction through `POST /songs/import` — a pack is added completely or not at all, where the old importer called `POST /songs` once per row and could leave one half added.
- A song now carries the difficulty slot its chart was written for as well as its meter. `SongChartDifficulty1787800000000` adds the nullable column and the check constraint over the six names; `Beginner` and `Challenge` are stored as `Novice` and `Expert`, the names a cabinet shows. A slot no version of StepMania names is not guessed: the chart is skipped and reported. Songs added by hand keep a null slot and the ranked meter colour.
- The songs list draws the slot in the colour ITGmania gives it, from new `chart-*` tokens that repeat the judgment palette because it is the same cabinet palette.
- Verification passed: `npm run check:architecture`, `npm run build` across every workspace, `npm run lint` (pre-existing warnings only), 37 frontend unit tests including 22 new ones, 94 API end-to-end tests including four new ones, and the migration-runner test. The schema builder reports no difference between the new migration and the entity metadata.
- Not yet confirmed by hand: the import dialog itself, which needs a real `Songs` folder and a Chromium-based browser.

### Withdrawing an entrant now means withdrawn

Reported by the user on 2026-08-23: removing the last of five entrants made the person vanish from the entrants page entirely, and a reload brought them back with their Remove button, so nothing could be added back.

- Root cause: removal withdraws an entrant rather than deleting it — `EntrantService.removeSinglesEntrantByParticipant` sets `status = 'withdrawn'`, and `addSinglesEntrant` reactivates that same row — but neither read respected the status. `DivisionQueries.availableParticipants` treated any entrant, withdrawn included, as occupying its participant, so a removed person was never offered again; `usePlayersTab` counted any entrant's participants as competing, so after a refetch they read as present. The two together made a removal irreversible from the interface.
- The behaviour predates the phase 5 rewrite: `DivisionService.getAvailableParticipants` built its assigned set from `division.entrants` with no status filter, and the players tab read the summary's entrants the same way. The rewrite preserved it faithfully and the empty `available-participants` response is what made it visible.
- Fixed in both reads. The `NOT EXISTS` behind `availableParticipants` now matches only an active entrant, and `usePlayersTab` counts only active ones as competing. The roster keeps returning withdrawn entrants with their status, which is what the seeding tab and the create-match modal already filter on and what `entrantCount` in the tree already counted.
- Covered end to end: add, remove, and add back, asserting the entrant's status and the offer at each step. Confirmed the case fails without the `status` predicate and passes with it.
- Verification passed: `npm run build` across every workspace, `npm run lint` (four pre-existing API warnings and six pre-existing frontend warnings, none in the changed files), 116 unit tests, and 37 end-to-end tests against PostgreSQL, one of them new.

### Division pages: standings removed, seeding made reorderable

Requested by the user on 2026-08-23, outside the phase sequence.

- Removed the division standings page, its route and its tree destination. Every number a tournament reports is to be composed on Stats instead. `useDivisionStandings` went with it, which was one of the last fetching effects outside react-query.
- Kept `GET /divisions/:id/standings` and `StandingsQueries.forDivision`, which now have no consumer. They are the one aggregate already written and tested against a real PostgreSQL, and FQ-016 names a per-division roll-up as a candidate for what Stats should show. Recorded there as a deliberate exception to the rule that an endpoint has a caller.
- Fixed the seeding tab, which could not be reordered at all: it passed `canEdit={false}` to `EntrantMembershipRow`, and the row drew its drag handle only when `canEdit` was true, so the handle never rendered and the save button had nothing to save. The drag context around it had been in place the whole time.
- The whole row is the drag handle now rather than a grip beside it, which is the target a person aims at when they mean to pick up a name, and the handle props carry keyboard reordering — space to lift, arrows to move. The grip stays as the cue and a row being dragged is drawn raised.
- Known and not changed: dragging while the search box is filtering permutes the visible rows among their absolute positions and leaves hidden rows pinned. That is the defensible reading of a filtered reorder, but it means a drop between two filtered names can move somebody many places. Raise it with the user before changing the semantics.
- Verification passed: `npm run build` across every workspace, `npx tsc --noEmit` in both workspaces, `npm run lint` (four pre-existing API warnings and six pre-existing frontend warnings, none in the changed files), and 116 unit tests. No API contract changed. The manual UI check is the user's, and the drag is the part only it can confirm.

### Structure refactoring phase 5, the tree and the projection collapse

- Added `structure/tree.queries.ts`. One query parameterized by scope answers the tournament overview, the division summary and a single pool node; two more give it the pending-match count of every pool in scope and the advancement rules of all of them at once. Three queries whatever the scope holds.
- The two projections it replaces had drifted. `TournamentOverviewDto` carried `pendingMatchCount` and no advancement rules, `DivisionSummaryDto` carried the rules and no pending count, and both carried an `entrants: []` on a pool that no loader ever filled. They are one shape now, so a pool reads the same wherever it appears.
- A division states `entrantCount` instead of carrying its roster. The tournament tree was downloading every entrant of every division, with participants and players, to draw a list of names it never showed. The three places that show people — the players tab, the seeding tab and the add-players dialog — read `GET /divisions/:id/entrants`, which phase 5 had already made a projection, through one cache entry per division.
- That route orders by the persisted seed, so the seeding tab opens on the order its last save wrote rather than alphabetically. FQ-015 is partly resolved: the order is visible, and whether `seedNum` itself should be on the wire is what remains.
- Pool mutations answer with `TreeQueries.phaseGroup`, so `POST /phases/:phaseId/phase-groups` and `PATCH /phase-groups/:id` return the node the tree draws. `PhaseGroupManager.toDto` is gone.
- The tree orders divisions, phases and pools by id. Neither previous read stated an order for them, and the end-to-end test of the overview had been asserting `phaseGroups[0]` against whatever PostgreSQL returned; it addresses the pool by id now, and asserts the default pool a phase is created with as well.
- Removed: `TournamentManager.findOverview`, `DivisionManager` entirely, `DivisionService.findOneForSummary` and `findOverviewData`, `PhaseService.findOverviewDataForDivision`, `AdvancementRuleService.findBySources`, and `MatchQueries.pendingCountsByPhaseGroup`, which the tree now owns. `RoundRobinMatchesView` lost the `phaseGroup` prop it read the empty entrant list from; the players of its axes have always come from the matches.
- Phase 5 is complete. Eight `*.queries.ts` classes cover every read endpoint, no controller reaches a service for a `GET`, and no route answers with a TypeORM entity except the phase and division write paths that phase 7 turns into commands.
- Verification passed: `npm run check:architecture`, `npm run build` across every workspace, `npm run lint` (four pre-existing API warnings and six pre-existing frontend warnings, none in the changed files), 116 unit tests across the workspaces, and 36 end-to-end tests against PostgreSQL — three of them new, covering the collapsed projection at the division scope, the pool node a mutation answers with, and the exact key set of a pool. The manual UI check is the user's.

### Structure refactoring phase 5, catalogue and score read models

- Added `catalog/song.queries.ts` with `forTournament` and `competition/score.queries.ts` with `history`. `GET /songs` answers `SongDto[]` and `GET /scores` answers `ScoreDto[]`; both used to answer with TypeORM entities while the frontend already declared the DTOs, so no frontend file changed.
- `ScoreDto` is one shape now. `catalog.ts` declared it with its player and its song, and `match.ts` declared the same three fields again as `MatchScoreDto`. A standing shows the run behind its points and the standing dialog offers the runs a player already has on the song it is editing; both know the song and the player already, so the projection carries neither. It lives in `projections.ts` beside the other shapes written once.
- `GET /scores` now requires both `songId` and `playerId`. It treated each as optional and answered with every score in the database when neither was given, which no client asked for and nothing bounded.
- Removed `GET /songs/:id/scores`, which no client called, and `ScoreService` with it: `create`, `update` and `findOne` had no caller either, because the match store owns score writes. `competition/dtos/score.dto.ts` and its two barrel exports went with the service.
- `TournamentService.findSongsByTournamentId` became `SongService.findByTournament`, which is where `SongRoller` reads it. The roller needs entities to attach one to a round, so that load stays on the write side; `SongQueries.forTournament` answers the same question for a reader.
- `songs.controller.ts` is `catalog/song.controller.ts` and `scores.controller.ts` is `competition/score.controller.ts`, each beside the queries it reads. `competition/controllers/` no longer exists. Phase 8 had claimed both moves and put the scores controller in `catalog/`; the target tree puts `score.queries.ts` under `competition/`, and a controller belongs beside its queries, so the tree decided it.
- The two `ScoreService` cases in the persistence end-to-end suite became two `ScoreQueries.history` cases: the order it returns, and that neither of its two conditions may be dropped. Added `tests/e2e/catalog/song-reads.e2e-spec.ts` with two more, covering the scope of the list and each key of its sort.
- Verification passed: `npm run check:architecture`, `npm run build` across every workspace, `npm run lint` (four pre-existing API warnings and six pre-existing frontend warnings, none in the changed files), 116 unit tests across the workspaces, and 34 end-to-end tests against PostgreSQL. The manual UI check is the user's.

### Structure refactoring phase 5, division read models

- Added `structure/division/division.queries.ts` with `entrants` and `availableParticipants`, and `competition/standings.queries.ts` with `forDivision`. All three are SQL, and all three replace a graph load.
- `availableParticipants` was the most expensive read left in the structure routes. It loaded the division, its tournament, every participant of that tournament with its player and account, and every entrant of the division with its participants, then subtracted one set from the other in JavaScript. It is a `NOT EXISTS` against the join table.
- `forDivision` replaces the second-largest `relations` block in the application — the division through its phases, pools, matches, results, rounds, songs, standings, scores and players — with one `GROUP BY`. It keeps the rule the roll-up applied: a hand-scored round awards points without a song having been played, so a standing counts towards the total either way and towards `songsPlayed` only when its round has a song.
- `GET /divisions/:id/entrants` and `GET /divisions/:id/available-participants` answer with `EntrantDto[]` and `ParticipantDto[]`. Both used to answer with raw TypeORM entities while the frontend already declared the DTOs, so no frontend file changed; the API now produces what the interface reads. The entrant projection carries no `seedNum`, which is the shape it already declared and which FQ-015 still holds open.
- Kept the `404` for a division that does not exist. An empty collection cannot say it, so the three read routes ask `DivisionQueries.exists` first — the same shape `MatchQueries.exists` already had.
- Removed: `DivisionService.findOneForStandings`, `getEntrants`, `getAvailableParticipants` and `sortBySeed`, and `DivisionManager.findStandings`.
- `divisions.controller.ts` is `structure/division/division.controller.ts`. `division.service.ts` and `division.manager.ts` stay under `services/` for the same reason the tournament pair did: phase 7 splits them into a store and commands.
- The unit test of the seed order moved into the end-to-end suite together with the order itself, which the query now owns. 69 API unit tests, one fewer, and a new `tests/e2e/structure/division-reads.e2e-spec.ts` with four.
- Verification passed: `npm run check:architecture`, `npm run build` across every workspace, `npm run lint` (four pre-existing API warnings and six pre-existing frontend warnings, none in the changed files), 116 unit tests across the workspaces, and 32 end-to-end tests against PostgreSQL. The manual UI check is the user's.

### Structure refactoring phase 5, registration read models

- Added `registration/participants.queries.ts` with `forTournament` and `importPreview`, both SQL. The inventory in [ApiRefactoring.md](ApiRefactoring.md) had allowed one `find({ select })` here; both are lists of a projection joined across two tables, which is the case that table sends to SQL.
- `importPreview` is a join on the normalized name. It used to load every player in the system, build a map keyed by that name, and look each requested name up in it. The names arrive as one array parameter and keep the order the client sent through `WITH ORDINALITY`, so the response still lines up with the list on screen.
- `PlayerService.findByNameNormalized` stopped scanning the catalogue for the same reason, and `TournamentManager.createParticipant` calls it rather than repeating that scan inline. Both now take the older of two players whose names normalize alike, so the answer is deterministic; duplicates of that kind are a defect in the catalogue rather than a choice for a read to make.
- `forTournament` orders by the lowercased player name. `ParticipantService.listForTournament` sorted with `localeCompare` after loading the rows, and also loaded an `account` relation that the projection never read.
- Removed: `TournamentManager.listParticipants` and `previewParticipantImport`, `ParticipantService.listForTournament`, and `findForTournamentByPlayerNameNormalized` and `listStaff`, neither of which had a caller.
- `tournament-participants.controller.ts` is `participants.controller.ts`, the name the target layout gives it. The class keeps its name until phase 7 splits the manager behind it.
- No contract changed: both routes already answered with the shapes the frontend declares.
- Verification passed: `npm run check:architecture`, `npm run build` across every workspace, `npm run lint` (four pre-existing API warnings and six pre-existing frontend warnings, none in the changed files), 117 unit tests across the workspaces, and 28 end-to-end tests against PostgreSQL — one of them new, covering the order of the list, its exact projection, the trimmed-form deduplication of requested names and the case-insensitive match behind the preview.

### Structure refactoring phase 5, tournament read models

- Added `management/tournament.queries.ts` with `byId`, `configuration`, `publicList`, `hasStartggApiKey` and `rolesFor`. Four are `find({ select })`; `rolesFor` is one SQL query where `TournamentService.getMyRoles` ran two query-builder reads of the same four-table join differing only in the role they matched.
- `rolesFor` matches a role as an element of the stored `simple-array` rather than as a substring of it. The previous `LIKE '%owner%'` would have matched any role containing the word; nothing in the current vocabulary does, so no behaviour changes and the query no longer depends on that.
- Every write of a tournament — create, update, close, reopen — now answers with `TournamentQueries.byId`. `TournamentManager.toResponseDto` and `toConfigurationDto` are gone, and with them the last hand-written mapping of the tournament record.
- `TournamentDto` lost `staff`, and `TournamentStaffDto` with it. The field was mapped from `tournament.participants`, which no loader behind it ever populated, so every response carried an empty array; no client read it. FQ-017 asks whether a tournament response should name its staff at all.
- `GET /tournaments/public` answers `TournamentRefDto[]`. It already selected `id` and `name` only, and its two consumers — the home page and the search dialog — read nothing else, so the contract now states what the route always sent.
- Removed from `TournamentService`: `findAllPublic`, `findOne`, `findOneForPage`, `findOneForUpdate`, `getMyRoles` and `findByPhase`, the last of which had no caller. What remains is the write side plus `findSongsByTournamentId`, which goes when `SongQueries` lands.
- Departure from the plan as written: `tournament.service.ts` and `tournament.manager.ts` stay under `services/`. Phase 7 gives Tournament its four roles, and `TournamentManager` still holds the participant write paths that belong to `registration/`; moving the pair into `management/` now would move them again a phase later, and split wrongly in between.
- Verification passed: `npm run check:architecture`, `npm run build` across every workspace, `npm run lint` (four pre-existing API warnings and six pre-existing frontend warnings, none in the changed files), `npm run test:contract`, 117 unit tests across the workspaces, and 27 end-to-end tests against PostgreSQL — one of them new, covering the record, the configuration, the key status before and after a key is set, and the roles of the account that owns the tournament. The manual UI check is the user's.

### Container images repaired after the contracts-on-scoring edge

- Fixed the build chains in `apps/api`, `apps/realtime` and `apps/syncstart`, which built `@tournament-manager/contracts` before `@tournament-manager/scoring` or never built scoring at all. Phase 3 added that dependency edge and recorded it in `check-architecture`, but the images build their workspaces by a hand-written chain, so `npm run local:up` had been failing on the first image it reached ever since.
- Fixed `apps/frontend/Dockerfile`, broken differently for the same reason: its builder copies only the package manifests plus `apps/frontend`, so once the viewer began importing the contracts package there was no `packages/contracts` in the image to resolve. It now copies and builds scoring and contracts before the viewer.
- Extended `check-architecture` to verify each app's Dockerfile against the dependency graph it reads from the workspace manifests: every transitive dependency must be built, and never after something that depends on it. Confirmed it fails on both original faults — a missing workspace and an inverted order.
- The `npm run local:reset` and `npm run verify:local` results recorded in the Verification block below predate phase 3 and did not cover this. Re-run them.
- Verification passed: `docker compose build` builds all seven images, and `npm run check:architecture`.

### Statistics page emptied and its endpoint removed

- Removed `GET /divisions?tournamentId=` with `DivisionService.findAll` and `findAllForTournamentCards`, the largest `relations` block in the codebase: divisions through entrants, phases, pools, matches, results, rounds, songs, standings and scores. No end-to-end test covered it and it had one consumer.
- Emptied the statistics page. Its score table downloaded that graph and recomputed every total in the browser; its three counters — divisions, players, matches — came from the tournament overview because the overview happened to carry them. Neither answered a question anybody had asked.
- Removed with them: `useTournamentStatsData`, `useTournamentStatsPage`, `TournamentStatsPlayerList`, `TournamentStatsSearch`, `TournamentOverviewSummary`, the seven `TournamentStats*` types and `listTournamentStatsDivisions`. Nothing else called any of them.
- Recorded FQ-016 in [FunctionalQuestions.md](FunctionalQuestions.md): what numbers a tournament needs, and who reads them. The page stays empty until that has an answer, and the answer decides the query rather than the other way round.
- Amended phase 5 of [ApiRefactoring.md](ApiRefactoring.md): `GET /tournaments/:id/standings` is no longer part of it, and no read model replaces the removed endpoint. This also leaves `division.entrants` in the overview projection with no frontend consumer, which the projection collapse should take.
- Verification passed: `npx tsc --noEmit` in both workspaces, `npm run build` across every workspace, `npm run lint` (six pre-existing frontend warnings, none in the changed files), 70 API unit tests, 9 frontend unit tests, and `npm run check:architecture`. The HTTP contract lost one route and no other route changed. The manual UI check is the user's.

### Structure refactoring phase 4, closing slices: song, live, auth, participant

- Completed the song slice. `createSong` and `deleteSong` joined `listSongs` in `api/song.api.ts`; the songs list had been requested with a hand-written `axios.get` in four places, each spelling the `tournamentId` query string itself. The pack delete keeps its loop; the bulk import lost its own when `POST /songs/import` replaced it.
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

### Phase 6 of the API refactoring: one update path

- Made every mutation under `src/tournament` answer `204`, with two stated exceptions: a creation answers `201 { id }` because an event cannot tell a caller the address of something that did not exist when it sent the request, and a commit answers `200 { startggReport }` because the outcome of an external side effect concerns whoever pressed the button rather than everyone watching. Ten match commands lost the projection that followed their save, and `MatchCommands` no longer holds `MatchQueries`.
- Deleted the reducer beside the query cache in `useMatches`, with `matchesReducer.ts` and `matchesActions.ts`. Each action used to write both copies and then receive the same change a third time over the socket, and the patch it applied was only ever right for the match it addressed.
- Narrowed the realtime invalidation to what an event names, in `staleAfterUpdate`. A match event stales two match lists; the tree moves under a pool event, which a match write publishes only when the pool's own counts changed. `MatchAggregate.poolState` decides that in the terms `TreeQueries` counts them.
- Dropped the by-hand tree refresh from the structural mutators, so the person who renamed a pool and the person watching it now see it the same way. `refreshTree` remains for bracket generation, which navigates into what it just built.
- Fixed `DivisionService.update`, which published nothing: a renamed division only moved for whoever renamed it.
- Added `tests/unit/alias-resolver.mjs` so `node --test` resolves the `@/` alias. Without it only files importing types alone could be covered, which is a strange rule for what a test may cover.
- Verification: `npm run verify` passes — architecture boundaries, every workspace build, lint (nine pre-existing warnings, none in the changed files), contracts, 131 unit tests, 38 API e2e tests against PostgreSQL, and the migration-runner e2e test. `npm run local:up` rebuilds every image and the stack comes up healthy; `node scripts/verify-local.mjs` passes all eleven checks.
- Next action: phase 7 of [ApiRefactoring.md](ApiRefactoring.md) — give Division, PhaseGroup, Tournament and Song the four roles Match has, one branch per aggregate, moving each into its target directory in the commit before the one that changes its roles. The writes that still publish nothing — division entrants and advancement rules — get their events there, and their callers lose the by-hand re-reads noted above.

### Phase 7 of the API refactoring: the division aggregate

- Gave Division the four roles Match has. `structure/division/` now holds the controller, the commands, the aggregate, the store, the queries and the requests; `DivisionService` and `EntrantService` are gone, and one graph loads a division for writing instead of four loaders that differed only in their relations.
- Fixed the gap phase 6 recorded: admitting and withdrawing somebody published nothing, so a person added to a division appeared only for whoever added them. Both announce `ui.division-changed`, addressed from the graph the store loaded rather than looked up afterwards.
- Made seeding one save instead of one per entrant, and made the entrants a bracket is built from arrive in the order the division seeded them. They used to come back in whatever order the database produced, which meant the seeding page decided nothing about the bracket.
- Moved bracket generation into `DivisionCommands`, which is the aggregate a generated structure belongs to. `BracketManager` is gone; the controller keeps the list of systems. The systems lost the `division` argument none of them read. An unknown bracket type answers `400` instead of failing on an undefined system.
- Replaced the roller's division load — five levels of relations, once per level rolled — with `SongQueries.playedInDivision`. What a wrong `divisionId` means is recorded as FQ-018.
- Split the start.gg integration in two rather than leaving the dependency cycle the change exposed. That class was both the provider importer and the report client, and once the importer registered divisions it reached the bracket systems and so the match commands again. `StartggMatchReporter` is the outbound half — it reads the mappings the importer wrote and calls the client — `MatchCommands` depends on that alone, and no `forwardRef` remains in the repository. Its entrant mappings became one query instead of one per entrant, and the path gained the six unit tests it never had.
- Dropped the three by-hand refreshes the frontend ran after a roster or seeding write. `refreshDivision` stays for the advancement rules alone, which are not an aggregate and still announce nothing.
- Verification: `npm run verify` passes — architecture boundaries, every workspace build, lint (eight pre-existing warnings, none in the changed files), contracts, unit tests including the new `division.aggregate.spec.ts`, 49 API e2e tests against PostgreSQL and the migration-runner e2e test. Eleven of those e2e tests are new, in `division-writes.e2e-spec.ts`: what each write announces, that a re-admitted participant keeps the entrant and the seed they had, that a command loads the division once, and that a generated bracket seats the entrants in seeded order. Frontend `tsc --noEmit`, `eslint`, `vite build` and `node --test` (15/15) pass.
- Next action: continue phase 7 of [ApiRefactoring.md](ApiRefactoring.md) with the PhaseGroup aggregate — `phase-group.{controller,commands,aggregate,store,queries,requests}.ts`, `syncDerivedEntrants` and `replaceEntrants` as commands with array saves, and the advancement rules given the events whose absence still forces `updateMatchAdvancementRules` and `refreshDivision` to re-read by hand. `MatchCommands` calls `PhaseGroupService.syncDerivedEntrants` today, so that slice has to settle how one aggregate's write reaches another without one commands class calling the next.

### Phase 7 of the API refactoring: the phase group aggregate

- Gave PhaseGroup the four roles Match and Division have. `structure/phase-group/` holds the controller, the commands, the aggregate, the store and the queries; `PhaseGroupService` and `PhaseGroupManager` are gone, and with them the graph that loaded every match of a pool with its entrants and their players to answer whether a name had changed.
- Settled how one aggregate's write reaches another, which is what this slice existed to decide. `MatchCommands` called `PhaseGroupService.syncDerivedEntrants` after four of its commands; that method copied the entrants of a pool's matches into seat rows, one query and one save per entrant. The copy was the problem rather than the call: a seat is what the pool decided — a generated bracket's seating, or a placement an advancement rule produced — and playing in a match of the pool is derived. `PhaseGroupQueries.entrants` derives it in one query, `syncDerivedEntrants` is deleted, and `MatchCommands` no longer depends on the pool at all.
- Recorded the rule the aggregates actually follow, in [ApiRefactoring.md](ApiRefactoring.md): a command may create the structure below it — a division generates a phase, a pool and its matches — and may not maintain the structure above or beside it. Anything that has to be maintained is either derived on read or the same aggregate.
- Made `AdvancementManager` work through the two stores and their aggregates rather than through either commands class, because an advancement rule is an edge between two competitions and that is the one place a write to one aggregate changes another. Four entrants moving into one pool now load and announce that pool once; completing a pool marks who advanced and closes it in the same save, where it used to be three loads, a save per seat and two events.
- Gave the advancement rules the event whose absence phase 6 recorded. They have no aggregate, so they read their address in `PhaseGroupQueries` and announce the pool their source sits in, which is the read a rule changes. The frontend dropped both by-hand re-reads that stood in for it, and `refreshDivision` with them — no write under a division announces nothing any more.
- Deleted `UiUpdateContextService`, 138 lines and a lookup query for every event published. Every caller already held the address: the pool writes carry it in their graph, a match that changed pools carries the one it left, the phases load their division with its tournament, and the start.gg import knows what it is importing into.
- Removed `GET /phase-groups/:id/entrants`, which phase 0 kept only because its end-to-end test was the only coverage of derived pool membership. That coverage asserts against `PhaseGroupQueries` now.
- Decided the open question about `Phase`: it is not an aggregate. It is a name and a position inside the division that holds it, it publishes a division event, and its three commands belong on `DivisionCommands`. `PhaseService` keeps them for now and addresses its event from the division it loads; folding it in goes with the Tournament slice.
- What a pool's seats say about somebody the pool never seated is recorded as FQ-020.
- Verification: `npm run verify` passes — architecture boundaries, every workspace build, lint (three pre-existing warnings, none in the changed files), contracts, 103 unit tests including the new `phase-group.aggregate.spec.ts`, 61 API e2e tests against PostgreSQL and the migration-runner e2e test. Ten of those e2e tests are new, in `phase-group-writes.e2e-spec.ts`: what each write announces, that a pool takes the first free letter of its phase, that an entrant a match introduced is read without a seat and leaves with the match, that creating a match writes no row into the pool, that a generated bracket seats people in seeded order, that an advancement rule announces the pool its source sits in, and that a command loads the pool once. Frontend `tsc --noEmit`, `eslint`, `vite build` and `node --test` (15/15) pass.
- Next action: continue phase 7 of [ApiRefactoring.md](ApiRefactoring.md) with the Tournament aggregate — `management/tournament.{controller,commands,aggregate,store,queries,requests}.ts`, absorbing `TournamentService`, `TournamentManager`, `ParticipantService` and the phase commands that `PhaseService` still holds, so `structure/services/` is left with the advancement rules alone. `TournamentManager.createParticipant` loads every player in the system to find one by name, which is the last of the collection loads the problem statement named.

### Phase 7 of the API refactoring: the tournament aggregate

- Gave Tournament the four roles Match, Division and PhaseGroup have. `management/` holds the controller, the commands, the aggregate, the store, the queries and the requests; `registration/` holds the second surface on the same aggregate. `TournamentService`, `TournamentManager`, `ParticipantService`, `PlayerManager` and `PhaseService` are gone, and with them `src/tournament/services/` and `src/tournament/dtos/`.
- Made the participants part of the tournament, because a participant is one person in one tournament and has no life outside it. `TournamentAggregate.register` merges the roles of somebody already registered instead of creating a second row — the rule `ensureForPlayer` spelled as a query and a save per person — and every surface that registers people ends there: a name, a chosen player, a pasted list, and the start.gg import, which registers a whole event in one load and one save.
- Gave the tournament writes the events they never published. Renaming a tournament, changing its scoring system or closing it moved for whoever did it and for nobody else; all three publish `ui.tournament-changed` now, and closing one that was already closed publishes nothing.
- Moved two things out of the controller: registering the creator as owner, and telling SyncStart where the lobbies live. Both are consequences of the write rather than decisions the caller makes, and the second is why the write had to answer with the SyncStart URL it replaced.
- Settled the open question about `Phase`: it is not an aggregate. It is a name and a position inside the division that holds it, so its commands are `DivisionCommands.addPhase`, `renamePhase` and `removePhase`, its routes are a second surface on the division, and what it publishes is the division event it always published. The bracket systems lost the `PhaseService` none of them called.
- Settled two naming decisions with the user: `Player` is a catalogue like Song and is refactored with it, and `AdvancementManager` becomes `AdvancementRunner` in `structure/advancement/` during phase 8 — the rules are the data, the runner is what walks them, and it is not a commands class because it writes through the match and pool stores.
- Verification: `npm run verify` passes — architecture boundaries, every workspace build, lint (three pre-existing warnings, none in the changed files), contracts, 118 unit tests including the new `tournament.aggregate.spec.ts` and the phase rules added to `division.aggregate.spec.ts`, 73 API e2e tests against PostgreSQL and the migration-runner e2e test. Twelve of those e2e tests are new, in `tournament-writes.e2e-spec.ts`: what each write announces, that registering the same person twice leaves one participant, that unregistering somebody withdraws their entrants through the division first, that SyncStart is told only when its URL moved, and that an imported list costs one load of the tournament.
- Next action: finish phase 7 of [ApiRefactoring.md](ApiRefactoring.md) with the Song and Player catalogues — `catalog/song.{controller,commands,store,queries}.ts` absorbing `SongService` and `song.roller.ts`, `CompletedSongService` splitting so that its effect becomes `MatchCommands.applyCompletedSong()` and only its SyncStart-facing endpoint stays behind, and `PlayerService` becoming `catalog/player.{controller,commands,queries}.ts`. That leaves `structure/services/` holding the advancement rules alone, which phase 8 moves and renames.
- Left behind on purpose: the tournament configuration and participants pages still hold their state in `useState` and re-read by hand after a write, so the new `ui.tournament-changed` event stales the tree rather than those pages. Putting them on the query cache is frontend work phase 4 did not finish.

### Phase 7 of the API refactoring: the song and player catalogues

- Gave Song and Player the roles that fit them, which is not four. `catalog/` holds `song.{controller,commands,store,queries,requests}.ts`, `song-roller.ts` and `player.{controller,store,queries,requests}.ts`; `SongService` and `PlayerService` are gone, and with them `src/tournament/player/`, `src/tournament/competition/services/` and `src/tournament/competition/dtos/`.
- Decided that Song is not an aggregate, correcting the model in [ApiRefactoring.md](ApiRefactoring.md). A song has no invariant to protect and no consequence to publish, so it has a store and two commands and no aggregate file. The player catalogue has no commands class at all: nobody creates a player on purpose — they appear because somebody was registered, imported, pasted into a division or brought in by a start.gg event, and the decision belongs to the write that had a reason to make it.
- Removed the last loads of a whole table. `PlayerStore.byNormalizedNames` asks for the names the caller holds, so the start.gg import no longer loads every player in the application — twice — and creates the ones it does not find in one insert; the bulk add cost a query and an insert per name and is now one of each. `GET /players` answers with the projection the frontend already typed it as instead of with the entity.
- Fixed four defects the aggregate slices left behind, all found by the new end-to-end coverage: `importAll` and `addPlayersToDivision` read `participant.id` before the roster was saved, so a first-time registration had none — the import answered with nulls and the bulk add answered `404 Participant undefined not found` for every new name; and the two routes addressed by player passed a string id into a map keyed by number and into an `===` comparison, so admitting somebody to a division answered `404` and withdrawing them did nothing while announcing that it had.
- Made a roll one query and gave it the match's own scope. `SongQueries.rollable` is the tournament's pool minus what the division has played, where it was the pool as entities and a second query to subtract from it. `tournamentId` and `divisionId` are no longer sent by the caller: the roller reads them from `MatchAggregate.address`. That resolves FQ-018 and fixes what it exposed — the one client there is sent the division and never the tournament, and the roller answered with nothing unless it had both, so every rolled round silently added no song.
- Split the completed-song ingestion from its effect. `CompletedSongService` moved to `syncstart/` and no longer opens a transaction, writes standings or runs the scoring system: three reads resolve a whole lobby — the song of the pool, the names, and `MatchQueries.liveTargetsForSong` — and each match is then written once through the new `MatchCommands.applyCompletedSong`, which is the same aggregate call a person makes by choosing an existing run in the standing dialog. It used to load every active match of the tournament, with its entrants, rounds, standings and scores, once per player in the lobby. A run nothing was waiting for is still recorded, through `ScoreStore`, because a percentage is evidence of something somebody played.
- Recorded two behaviours rather than deciding them: what a lobby means by a song, which it reports by path against a pool keyed by title (FQ-021), and the bulk add that used to lowercase every name it matched or created (FQ-022).
- Verification: `npm run verify` passes — architecture boundaries, every workspace build, lint (three pre-existing API warnings and five pre-existing frontend warnings, none in the changed files), contracts, 128 unit tests including the new `song-roller.spec.ts` and `completed-song.service.spec.ts`, 90 API e2e tests against PostgreSQL and the migration-runner e2e test. Seventeen of those e2e tests are new, in `song-writes.e2e-spec.ts`, `player-catalogue.e2e-spec.ts` and `completed-song.e2e-spec.ts`: what a catalogue write announces, that a roll takes the level asked for from the division the match is in and never a song that division has played, that a pasted name matches the catalogue however it was capitalized and costs one lookup and one insert whatever the length of the list, that a completed song scores and ranks the round both players were playing, that its cost does not grow with how many other matches are live, that a run no round was waiting for is still recorded, and that a completion is scored once however often SyncStart resends it.
- Next action: begin phase 8 of [ApiRefactoring.md](ApiRefactoring.md) — the file tree and naming work that belongs to no aggregate: `bracket/` split into `bracket.{controller,commands}.ts` and `systems/`, the advancement rules moved into `structure/advancement/` with `AdvancementManager` renamed to `AdvancementRunner`, `shared/` created for the open-tournament guard, the UI update publisher and the common projections, the remaining DTO barrels deleted, `tests/unit` mirrored onto the final tree, and the realtime message shapes moved into `@tournament-manager/contracts`. No behaviour changes anywhere in that phase.

### Phase 8 of the API refactoring: file tree and naming

- Completed the non-aggregate structural work without changing routes or domain behaviour. Bracket generation now lives in `competition/bracket/bracket.{controller,commands}.ts` with kebab-case systems and `BracketSystem`; advancement rules and `AdvancementRunner` live together in `structure/advancement/`; and shared guard, publisher, and projections live in `shared/`.
- Deleted the tournament, account, auth-guard, and auth-strategy barrels. Request DTOs now live beside their controller, and the advancement unit test follows its final source location.
- Moved the flattened browser live-match DTO to `@tournament-manager/contracts`. Realtime and frontend now consume the same typed `players` projection rather than declaring it twice or using `unknown[]`.
- Added permanent architecture checks, executed in CI through `npm run check:architecture`, for the removed paths and barrels, axios placement, and duplicate Realtime DTO declarations. Recorded the corresponding lasting rules in Backend.md and Frontend.md.
- Verification: builds pass for contracts, API, Realtime, and frontend; API unit tests pass (128 tests); API lint passes with the three pre-existing warnings; contracts tests and `npm run check:architecture` pass. Full e2e and local-stack verification remain the next checkpoint.
- Next action: run the full e2e and local-stack verification. The remaining refactoring follow-up is the deliberately deferred frontend query-cache conversion for tournament configuration and participants, so their new realtime invalidations update the pages directly rather than only the tree.

### Test ownership follow-up

- Moved the scoring-system unit tests from the API tree into `packages/scoring/tests/unit/`. The scoring workspace now owns and runs its five calculator tests with `node --test`, so the API suite no longer tests code outside the API source tree.

### Query-cache follow-up

- Moved tournament configuration, participant roster, and player catalogue reads onto named TanStack Query entries. The configuration and participants pages no longer fetch in effects or re-read by hand after a write.
- Participant commands now publish `ui.tournament-changed`, including start.gg and player-to-division registration paths. That event invalidates the tournament tree, configuration, roster, and player catalogue for every connected browser, making the realtime path the sole way mutations reach those readers.
- Verification: frontend and API builds pass; frontend unit tests pass (48 tests); architecture checks pass. The scoring package suite passes (5 tests).
- Next action: run the full e2e and local-stack verification.

### Song query-cache follow-up

- Moved the tournament song catalogue and its header management menu onto one
  named TanStack Query entry. Deleted the `songsVersion` counter and every
  manual post-mutation refresh.
- Added the narrow `ui.songs-changed` event. Song create, non-empty import, and
  delete publish the tournament id; Realtime maps it to `SongsUpdate`, which
  invalidates only that tournament's song catalogue.
- A repeated import that writes nothing publishes nothing.
- Verification: frontend, API, and Realtime builds pass; frontend unit tests
  pass (49 tests); API unit tests pass (123 tests); Realtime unit tests pass (17
  tests); the Song writes e2e suite passes (11 tests); architecture checks and
  all three workspace linters pass with the existing warnings only.
- Next action: refactor the account and authentication source trees around
  explicit responsibilities without changing their HTTP or token behaviour.

### Account and authentication architecture follow-up

- Replaced `AccountService` with `AccountCommands`, `AccountStore`, and
  `AccountQueries`; account HTTP responses are explicit projections and the
  controller no longer maps persistence entities itself.
- Flattened the account and Auth controller/service trees. Auth now reads
  account credentials, profiles, and permissions through `AccountQueries`
  rather than injecting the Account repository. Guards and Passport strategies
  remain grouped by role.
- Removed the unused Auth request DTOs, the duplicate Auth controller/service
  registration in `AppModule`, and the unused AccountModule DataSource. Missing
  account write targets now answer `404` instead of being dereferenced.
- Extended the permanent architecture check to reject the removed account and
  Auth technical-role directories.
- Added `account-auth.e2e-spec.ts`: four HTTP tests cover normalized registration
  without credential leakage, rejected credentials, signed-in profile and
  permissions, self-only profile changes, and administrator list/flag changes.
- Full verification passes: architecture checks, every workspace build,
  contracts, all unit suites, 98 API e2e tests including the new account/Auth
  suite, and the migration-runner e2e test. Lint has the one pre-existing API
  warning and five pre-existing frontend warnings.
- Aligned the stale participant-unregistration e2e expectation with its two
  existing invalidations: Division updates entrants and Tournament updates the
  roster.
- Next action: run local-stack verification when a Docker checkpoint is wanted;
  no further account/Auth structural work remains in this plan.

### Formatting correction

- Removed the unrelated formatting churn introduced by running the repository-
  root formatter across the Song checkpoint. API files retain their existing
  indentation and single quotes, frontend files retain their local two-space
  and double-quote style, Realtime files retain their single quotes, and project
  documentation retains its manual wrapping.
- Added a permanent repository instruction to preserve each file's established
  formatting and never apply one root formatting profile across workspaces.
- Verification: API, frontend, and Realtime builds and unit suites pass;
  architecture checks pass; the Song and account/Auth HTTP suites pass (15
  tests); all three linters pass with the existing warnings only.

### Unified Prettier standard

- Replaced the temporary preserve-local-style rule with one repository-root
  Prettier configuration for every workspace: two spaces, 80-column print
  width, double quotes, semicolons, and trailing commas.
- Removed the API-specific single-quote override. A legacy file is converted in
  full when it is next modified; unrelated legacy files are not migrated
  speculatively.
- Added `npm run format` and an architecture check that requires the approved
  root configuration and rejects the former workspace override.
- Verification: Prettier reports every file touched by this checkpoint as
  formatted; architecture checks pass. No repository-wide legacy formatting
  migration was run.
- Next action: apply the root standard whenever a legacy file next enters the
  scope of a functional change.

### Match scoring strategy editing and formatting policy correction

- Added editable match scoring strategies. Changing a strategy persists it and
  recalculates every complete played round while leaving incomplete and
  hand-scored rounds consistent with their existing rules.
- Added `PlacementPointsIncludingFails`, renamed the existing strategies by
  behaviour, and added a migration for persisted strategy identifiers.
- Added **Edit scoring system** to the match actions menu with a focused editor
  and recalculation warning.
- Replaced the unified-reformat policy with preservation of each existing
  file's established format. New files and blocks use four-space indentation,
  compact imports and parameter lists, and multiline braced `if` bodies. The
  root Prettier defaults now use four spaces and a 160-column print width.
- Verification: architecture checks pass; all workspace builds pass; scoring
  tests pass (6 tests); API unit tests pass (125 tests); the match-write e2e
  suite passes (13 tests); the migration-runner e2e test passes; all workspace
  linters pass with the one existing API warning and five existing frontend
  warnings.
- Next action: run local-stack verification when a Docker checkpoint is wanted.

### Advancement rule editor

- Replaced the inline advancement-rule form with one focused modal shared by
  match and pool sources. The underlying match page remains visible, while the
  modal is centered, content-sized, and viewport-capped with an independently
  scrolling rule list.
- Rendered each draft as a compact editable sentence. Placement and target slot
  use matching native number controls; destination combines target kind and
  hierarchical path in one selector grouped by matches and pools.
- Kept the sentence inline on desktop. Narrow screens move the slot control and
  delete action onto a dedicated second line. Add, Save, and Cancel share the
  modal footer without repeating outgoing rules below match tables.
- Recorded the approved editor behavior and the deliberately deferred quick-
  rule proposal in `AdvancementRuleEditor.md`.
- Verification: frontend build passes; frontend unit tests pass (50 tests);
  frontend lint passes with the five pre-existing warnings; architecture checks
  pass.
- Next action: run local-stack verification when a Docker checkpoint is wanted.

## Verification

### API and frontend structure refactoring complete

- Closed phase 9 of [ApiRefactoring.md](ApiRefactoring.md). All aggregate,
  catalogue, file-tree, shared-contract and query-cache checkpoints are complete;
  the lasting boundaries are recorded in Backend.md and Frontend.md and enforced
  by `npm run check:architecture`.
- Aligned the match-write event contract with the progress projection introduced
  by the tournament status rollup: the first played score changes the pool's
  progressed-match count and therefore announces `ui.phase-group-changed`;
  subsequent score edits that do not move a pool projection still announce only
  the match.
- Verification: `npm run verify` passes with 99 API e2e tests. Lint reports the
  one existing API warning and five existing frontend warnings, with no errors.
- Next action: no work remains in the API and frontend structure refactoring
  plan. Future changes follow the permanent architecture rules.

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
