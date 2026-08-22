# API and Frontend Structure Refactoring

## The problem

The API grew by addition. Each time a view needed data, a loader was added for
it; each time an operation needed a step, a manager was added for it. Nothing
was ever taken away, so the same knowledge now exists in several places with
accidental differences between the copies.

The result is measurable rather than a matter of taste.

**One reading shape, written many times.** `DivisionService` holds eight
loaders that differ only in their `relations` tree: `findOneForSummary`,
`findOneForStandings`, `findAllForTournamentCards`, `findOverviewData`,
`findOneForView`, `findOneForBracketGeneration`, `findEntrantsOnly`,
`findOneBasic`. `MatchService` holds five. Across `src/tournament` there are 44
hand-written `relations` blocks, several of them identical and several
differing in ways nobody can justify: `MatchService.findOneForView` loads
`matchAssignments` and `score.song`, while `findByPhaseGroupForView` loads
neither, and no requirement records which is right.

**Collection loads that repeat per element.** `MatchManager.toMatchListDto`
issues two advancement-rule queries for every match, inside
`Promise.all(matches.map(...))`. A pool of forty matches costs eighty queries
beyond the list itself. The batched form of the same lookup,
`AdvancementRuleService.findBySources`, already exists and is used elsewhere.
The same shape appears in `MatchService.create` and `update` (one `findOne` per
entrant id), `PhaseGroupService.syncDerivedEntrants`, `replaceEntrants` and
`markEntrantsAdvanced` (one `save` per row), `DivisionService.updateSeeding`,
and `TournamentManager.createParticipant`, which loads every player in the
system to find one by name.

**The same graph loaded several times per request.** Writing one percentage
through `PUT /rounds/:roundId/scores/:playerId` loads the full match graph
twice and issues about eleven queries. Committing a match result loads it five
times: once in `MatchWorkflowManager`, once for the pool in
`PhaseGroupService.findOne`, once again after the commit, once inside
`StartggService.reportCompletedMatch`, and once more in `GetMatchForView`.

**Entities exposed as responses.** `GET /divisions?tournamentId=` returns the
whole tournament graph as raw TypeORM entities — divisions through entrants,
participants, players, phases, pools, matches, results, rounds, songs,
standings and scores. Its only consumer is the statistics page, which then
recomputes totals in JavaScript.

**One projection written four times.** `MatchListEntrantDto`,
`DivisionSummaryEntrantDto` and `TournamentOverviewEntrantDto` are identical,
and their mapping code is copied into `MatchManager.toMatchListDto`,
`DivisionManager.findSummary`, `TournamentManager.findOverview` and
`toParticipantDto`. The frontend then declares the same shapes a fifth time in
`features/*/types/`, with no type relationship to the API at all.

**Two update paths for one change.** Every round and standing mutation answers
with the whole match, and also publishes `ui.match-changed`, which makes the
frontend invalidate the pool match list, the division match list, the division
summary and the tournament overview. One score entry produces one large
response and up to four refetches, one of which recomputes the pending-match
aggregate for the entire tournament.

**Dead code hidden behind a barrel.** `tournament/dtos/accountplayer.dto.ts`
(443 lines — the largest file under `src/tournament`), `acount.dto.ts` (82) and
`credentials.dto.ts` (18) are unreachable except through the
`tournament/dtos.ts` barrel. The `CreateAccountPlayerDto` actually in use is a
different file under `account/dtos/`.

The frontend has the matching condition. Twenty files reach the server outside
a `*.api.ts` module, seven of them view components. The `tournament` feature —
the largest — has ten files that call the API and one `*.api.ts`, which covers
start.gg only. `TournamentParticipantsPage` is 356 lines with thirteen state
and effect hooks; `TournamentConfigurationPage` is 362 lines with nine.

## The model

Every endpoint answers a **question** or performs a **command**. Never both.
The two halves want opposite things: a question wants few columns over many
rows in a flat shape and touches nothing; a command wants one complete
aggregate in object shape, enforces invariants, writes, and publishes. When
they share an object the write side wins, and reads inherit the whole graph.
That is what happened here.

### Four roles

Each aggregate is served by four files, and each has one reason to exist.

| Role | Responsibility | Constraints |
| --- | --- | --- |
| `*.queries.ts` | Reads and projects | Returns DTOs, never entities. Does not write or publish. Does not call services. |
| `*.aggregate.ts` | The domain rules | No injected dependencies, no `await`. Testable without a database. |
| `*.store.ts` | Loads and saves the aggregate | Exactly one graph definition per aggregate. |
| `*.commands.ts` | Orchestration | Load, apply, save, publish. No domain logic. |

`*.commands.ts` is one class per aggregate, not one class per use case. It stays
short by construction rather than by discipline: the rules live in the
aggregate, the projection lives in the queries, and each command performs
exactly one `store.load` and one `store.save`. For the match aggregate this is
thirteen commands — `create`, `update`, `delete`, `setActive`, `addRound`,
`removeRound`, `replaceRoundSong`, `upsertScore`, `upsertPoints`,
`removeStanding`, `commitResult`, `reopenResult`, `applyCompletedSong` — at
roughly 190 lines, against about 860 lines spread over `MatchManager`,
`MatchWorkflowManager`, `StandingManager` and the write half of `MatchService`
today.

If a commands class passes roughly 300 lines, the aggregate boundary is wrong
rather than the class being long. Bracket generation creates phases, pools and
matches, so it is a command on Division. `syncDerivedEntrants` is a command on
PhaseGroup, which `MatchService` currently calls by hand. The aggregates in this
application are Tournament, Division, PhaseGroup, Match and Song.

### Who may call whom

| Caller | May call |
| --- | --- |
| Controller | `*.queries` for `GET`; `*.commands` for everything else. Nothing else. |
| `*.commands` | Its own `*.store`, the publisher, outbound adapters, and `*.queries` only to build a response. |
| `*.aggregate` | Nothing. No injected dependencies. |
| `*.store` | The TypeORM repositories of its own aggregate. |
| `*.queries` | `DataSource` and its own repositories. Not other services, not other queries. |

Two prohibitions carry most of the weight:

- **A commands class does not call another commands class.** If a command must
  trigger another, either it is the same aggregate — in which case it is a
  method on the aggregate — or it is an event. Today `MatchManager` calls
  `MatchWorkflowManager`, which calls `AdvancementManager`, which calls
  `PhaseGroupService`, and each reloads what its caller already held.
- **Nothing calls a store or a service inside a `map` or a `for` over a
  collection.** When N elements need a value, the method is `findByIds(ids)` and
  the grouping happens in memory.

### One load per command

A command loads its aggregate once, applies the change in memory, saves, and
publishes.

```ts
async upsertScore(roundId: number, playerId: number, input: ScoreInput): Promise<void> {
    const { matchId } = await this.store.locateRound(roundId);
    const match = await this.store.load(matchId);
    const score = await this.scores.resolve(input, playerId, match.songOf(roundId));
    match.upsertScore(roundId, playerId, score, this.scoringSystems);
    await this.store.save(match);
    await this.publisher.matchChanged(match.address);
}
```

The store's graph joins through to the tournament, so the routing address of the
published event is already in hand. `UiUpdateContextService` — 138 lines and one
lookup query for every event published — is deleted rather than replaced.

Writing is one transaction through `DataSource.transaction()`, as
[Backend.md](Backend.md) already requires, with array saves in place of the
per-row saves in `syncDerivedEntrants`, `replaceEntrants`,
`markEntrantsAdvanced` and `updateSeeding`.

## Database access

There is one rule for choosing the style, and only two styles are allowed.

| Work | Style | File |
| --- | --- | --- |
| Load an aggregate in order to change it | `repository.findOne({ relations })`, one definition per aggregate | `*.store.ts` |
| Write | `repository.save()`, `DataSource.transaction()` | `*.store.ts` |
| Read one row, few columns, one table | `repository.find({ select })` | `*.queries.ts` |
| Read lists, projections, aggregates, counts | Raw SQL through `dataSource.query()` | `*.queries.ts` |

`createQueryBuilder` is not used for new reads. It is the middle style: it has
neither the brevity of `find()` nor the transparency of SQL, and it suggests a
portability it does not provide. The one case where it earns its place is a
query whose `WHERE` clauses are composed at runtime; this application has none
today.

Raw SQL is written in the file that maps its rows, never in a shared string
module. A query and the function that reads its columns are one thing: split
apart, renaming an alias breaks the mapper silently at runtime. This also
follows [Backend.md](Backend.md), which permits direct SQL where PostgreSQL
behaviour is clearer than a TypeORM equivalent and asks that it be kept
localized and named.

```ts
/** The rows the query below produces. Changing one without the other is a bug. */
type MatchRow = {
    matchId: number;
    name: string;
    phaseGroupId: number;
    roundId: number | null;
    songTitle: string | null;
};

const MATCHES_IN_SCOPE = `
    SELECT  m."id"           AS "matchId",
            m."name"         AS "name",
            m."phaseGroupId" AS "phaseGroupId",
            r."id"           AS "roundId",
            s."title"        AS "songTitle"
    FROM        "match" m
    LEFT JOIN   "round" r ON r."matchId" = m."id"
    LEFT JOIN   "song"  s ON s."id" = r."songId"
    WHERE       m."phaseGroupId" = $1
    ORDER BY    m."id", r."id"
`;
```

Six conventions, all visible in the file:

1. Parameters are always positional (`$1`, `$2`). Never interpolated.
2. Every alias is camelCase and matches its DTO field, so the mapper is a copy
   rather than a translation.
3. The row type is declared above the query, in the same file.
4. One function, one query. When two are needed they are two, both using `IN`,
   never inside a `map`.
5. The constant is private to its module. Two queries that look alike today
   diverge tomorrow, and sharing forces them to stay identical by accident.
6. No TypeORM entity crosses the boundary.

### Replaceability

The seam for a future change of database, a read cache, or a test without
PostgreSQL is the injected `*.queries` class, not the SQL text. It has a defined
method surface, returns DTOs, and can be replaced without touching a controller,
a command or the frontend. This is the shape [Backend.md](Backend.md) already
prescribes for SyncStart, where `SyncStartClient` is the port and
`HttpSyncStartClient` the adapter.

No `IMatchQueries`-style interfaces are introduced now. The class is the
contract; extracting an interface and registering a DI token takes minutes on
the day a second implementation exists, and creating it earlier doubles the file
count for a hypothesis.

Database portability is not a requirement. [AGENTS.md](../AGENTS.md) names
PostgreSQL as the authoritative store, and the migrations, entity mappings,
identifier quoting and PostgreSQL-specific constructs already in use would not
be isolated by extracting query text.

### The full read inventory

Eleven SQL queries and seven `find({ select })` reads cover every current read
endpoint.

| Class | Methods | SQL | `find({ select })` |
| --- | --- | --- | --- |
| `MatchQueries` | `byId`, `byPhaseGroup`, `byDivision` | 2 | — |
| `TreeQueries` | `forTournament` | 1 | — |
| `StandingsQueries` | `forDivision`, `forTournament` | 2 | — |
| `TournamentQueries` | `byId`, `configuration`, `publicList`, `rolesFor`, `hasStartggApiKey` | 1 | 4 |
| `ParticipantQueries` | `forTournament`, `importPreview` | 1 | 1 |
| `DivisionQueries` | `entrants`, `availableParticipants` | 2 | — |
| `PhaseGroupQueries` | `entrants` | 1 | — |
| `SongQueries` | `forTournament`, `scoresForSong` | 1 | 1 |
| `ScoreQueries` | `history` | — | 1 |

Three of them replace the most expensive reads in the application:
`DivisionQueries.availableParticipants` becomes a `NOT EXISTS` instead of
loading the tournament and filtering in JavaScript;
`ParticipantQueries.importPreview` becomes a join on the normalized name instead
of loading every player; `StandingsQueries.forTournament` becomes a `GROUP BY`
instead of sending the tournament to the browser.

Raw SQL is not protected by the compiler, so the safety net is elsewhere. Every
query carries an end-to-end test against a real PostgreSQL, and a migration that
renames a column updates its queries in the same commit.

## Responses and contracts

Three levels of representation, and only three.

| Level | Contents | Used by |
| --- | --- | --- |
| Ref | `{ id, name }` plus minimal discriminators | lists, menus, breadcrumbs, the tree |
| Summary | the resource plus counts and aggregate state of its children, never the children themselves | cards, tree, overview |
| Detail | the resource plus its direct children as Ref or Summary, one level only | detail pages |

An endpoint does not return four levels of nesting. A page that needs that makes
two requests. The single motivated exception is Match, whose Detail includes
rounds, standings and scores because that is its consistency boundary.

Response DTOs move to `@tournament-manager/contracts`, which already owns
transport-neutral SyncStart DTOs and internal HTTP contracts. The frontend
imports them instead of redeclaring them, so removing a field breaks the client
at compile time. Request DTOs stay beside their controller as `*.requests.ts`
with their `class-validator` decorators. No `dtos/` directory remains under
`src`.

Mutations answer `204`, and the update reaches the interface through the
realtime channel, which already exists and already recovers from missed events.
The alternative — answering with the full aggregate and suppressing the echo of
the client's own change — is workable but was not chosen. What is not acceptable
is the current state, where both paths run at once.

Wherever a mutation does return a projection, it calls the same `*.queries`
method the corresponding `GET` uses. A match is projected in one place.

## Directory layout: API

A directory is one thing in the domain; the files inside it are its roles.
[Backend.md](Backend.md) already states this as "organize API code by functional
capability before technical role", and the current tree applies it at the first
level and abandons it at the third: `structure/services/`,
`structure/controllers/` and `structure/dtos/` are organization by technical
role. Working on Division today means opening six directories.

```text
src/tournament/
  tournament.module.ts

  management/                       Tournament aggregate
    tournament.controller.ts
    tournament.commands.ts
    tournament.aggregate.ts
    tournament.store.ts
    tournament.queries.ts
    tournament.requests.ts

  registration/                     Participants within a tournament
    participants.controller.ts
    participants.commands.ts
    participants.queries.ts
    participants.requests.ts

  structure/
    division/                       division.{controller,commands,store,queries,requests}.ts
    phase-group/                    phase-group.{controller,commands,store,queries,requests}.ts
    advancement/                    advancement-rule.{controller,commands,store}.ts
    tree.queries.ts                 the read that spans division, phase and pool

  competition/
    match/
      match.controller.ts
      rounds.controller.ts          separate surface, same aggregate
      match.commands.ts
      match.aggregate.ts
      match.store.ts
      match.queries.ts
      match.requests.ts
    bracket/
      bracket.controller.ts
      bracket.commands.ts
      systems/                      single-elimination.ts, double-elimination.ts,
                                    king-of-the-hill.ts, manual.ts, bracket-system.ts
    standings.queries.ts
    score.queries.ts

  catalog/                          Song and its pool
    song.{controller,commands,store,queries}.ts
    song-roller.ts
    pad-roller.ts

  syncstart/                        already coherent; unchanged
  player/                           already coherent; gains the role suffixes

  shared/
    tournament-open.guard.ts
    ui-update.publisher.ts
    projections.ts                  player, participant and entrant, written once
```

Decisions inside this tree:

- No `dtos/`, `services/` or `controllers/` directories.
- `ui-update-context.service.ts` is deleted.
- `completed-song.service.ts` splits: the ingestion endpoint stays in
  `syncstart/`, and its effect becomes `match.commands.applyCompletedSong()`.
  It currently opens transactions and writes standings from outside the
  aggregate.
- `bracket/` becomes commands plus `systems/`, in kebab-case. `IBracketSystem`
  becomes `bracket-system.ts`; TypeScript does not use the `I` prefix.
- The configured path aliases keep pointing at the right places: `@match/*`,
  `@bracket/*`, `@player/*` and `@tournament/*` are unaffected.
- `tests/unit` mirrors the source tree, as Backend.md already requires.

## Directory layout: frontend

The current tree has `pages/` in two places — `src/pages/` and
`features/*/pages/` — with `TournamentPage.tsx` in one and its own child route
`TournamentOverviewPage.tsx` in the other. `features/*/services/` holds five
different kinds of thing: HTTP clients, reducers, persisted local state, hooks
and DTOs. `hooks/` and `services/use*.ts` are the same thing in two places.
`modals/` is not a category — a modal is a component. Three features are
vestigial: `admin/` holds one component, `entrant/` only types, `player/` only
an API module and types.

```text
src/
  app/
    router.tsx
    MainLayout.tsx
    providers.tsx              axios base URL and interceptors, QueryClient, Auth, Realtime

  pages/                       one file per route, mirroring the router; composition only
    HomePage.tsx  BrowsePage.tsx  LoginPage.tsx  RegisterPage.tsx  OBSPage.tsx
    account/     AccountInfoPage.tsx
    admin/       ManageRolesPage.tsx
    tournament/
      TournamentPage.tsx       layout
      OverviewPage.tsx  ParticipantsPage.tsx  SongsPage.tsx
      LobbiesPage.tsx   LivePage.tsx  StatsPage.tsx  ConfigurationPage.tsx
      division/
        DivisionPage.tsx       layout
        MatchesPage.tsx  PlayersPage.tsx  SeedingPage.tsx  StandingsPage.tsx

  features/
    match/
      api/    match.api.ts  match.keys.ts
      model/  useMatches.ts  matchStatus.ts  matchSearch.ts  types.ts
      ui/     MatchCard.tsx  MatchRow.tsx  MatchTable.tsx  StandingModal.tsx  bracket/  round-robin/
    tournament/   api/ model/ ui/
    division/     api/ model/ ui/
    song/         api/ model/ ui/
    live/         api/ model/ ui/
    auth/         api/ model/ ui/     absorbs PermissionContext and features/admin
    participant/  api/ model/ ui/     absorbs features/player

  shared/
    ui/        design system: BaseModal, MultiSelect, ContextMenu, StatusDot
    layout/    Sidebar, MobileNav, ResizableSidebar, ProtectedRoute
    realtime/  useRealtimeSocket
    lib/       utils and persisted state: treeState, themePreference, recentTournaments
  styles/
```

Three directories per feature, and only three.

| Directory | Contents | Rule |
| --- | --- | --- |
| `api/` | HTTP client and query keys | the only place `axios` appears |
| `model/` | hooks, contexts, pure functions, view types | no URLs, no JSX |
| `ui/` | components, modals included | no fetching effect |

The rules are checkable by grep, so they do not regress:

1. `axios` appears only in `features/*/api/*.api.ts`. No `axios` import in a
   `.tsx` file.
2. No `.tsx` file contains a `useEffect` that fetches. Remote state arrives
   through a hook.
3. Query keys are imported from `<feature>.keys.ts`, never written inline.

Rule 3 closes a live defect: `["matches", "phase-group", id]` is currently built
by hand in both `useMatches.ts` and `TournamentUpdatesContext.tsx`. If either
changes, invalidation stops working with no error.

Most of `features/*/types/` disappears, because response types come from
`@tournament-manager/contracts`; only view types remain, such as
`MatchHighlight`, `MatchPhaseOption` and `TournamentDivisionOption`.

`useMatches` loses its reducer. It currently keeps two copies of the same state
— `state.matches` and the TanStack Query cache — synchronized by hand in all
seventeen actions.

## Naming

| Subject | Rule | Current state |
| --- | --- | --- |
| API file names | kebab-case | `BracketSystemProvider.ts`, `IBracketSystem.ts`, `SingleElimination.ts` are PascalCase |
| API file suffixes | `.controller`, `.commands`, `.aggregate`, `.store`, `.queries`, `.requests` | `.service` and `.manager` with no criterion |
| Barrels | not used | `dtos.ts`, `guards.ts`, `strategies.ts` exist, and hid 543 dead lines |
| Frontend file names | PascalCase for components, camelCase otherwise | already followed |
| Methods | camelCase | `GetMatch`, `AddRound`, `CommitMatchResult` are PascalCase |

Backend.md already forbids `controllers.ts` and `services.ts` barrels. Extending
that to DTOs is consistent, and is precisely what allowed the dead files to
survive.

## Migration plan

The work is done as vertical slices, one aggregate at a time, not as a sweep
through layers. A file move never changes behaviour and a behaviour change never
moves files; the two go in separate commits.

Phases 0 through 4 leave the HTTP contract untouched, so they can be verified
against the existing end-to-end tests by comparing responses before and after.

**Every phase leaves the files it touched in the target layout**: the position
described under "Directory layout", a kebab-case file name, and camelCase
methods. The move is the phase's last commit, after its verification passes, so
it never shares a diff with a change of behaviour. A phase that rewrites an
aggregate and leaves it in the old directory has not finished.

What belongs to no aggregate — file names under `bracket/`, the barrels,
`shared/`, and the mirroring of `tests/unit` — is collected in phase 8 rather
than left to whichever phase happens to pass nearby.

### Branching

Each phase is developed on its own branch and merged into `main` when its
verification passes. A phase is the unit of review as well as the unit of work:
it leaves the application running, so `main` is never mid-refactoring.

- Branch name: `refactor/<phase>-<subject>`, for example `refactor/0-removals`,
  `refactor/1-match-queries`, `refactor/2-match-aggregate`.
- Commits within a branch stay separated by intent — removals, file moves, and
  behaviour changes never share a commit — so the branch can be reviewed
  commit by commit.
- A branch merges only after the verification named in its phase passes, and
  after `.ai/MigrationStatus.md` records the completed checkpoint and the next
  action.
- Phases 1 and 2 are two branches even though they are usually worked in one
  sitting: the read side merges and ships before the write side starts, which
  keeps the revert surface small if the projection turns out to be wrong.
- Phase 6 is the exception that spans both workspaces. Its API and frontend
  changes belong to one branch, because either half alone leaves the interface
  without an update path.
- Phases 4 and 7 are subdivided per feature and per aggregate, one branch each,
  rather than merged as a single large change.

### Phase 0 — Removals (done)

Six unreferenced files, 694 lines: `tournament/dtos/accountplayer.dto.ts`,
`acount.dto.ts`, `credentials.dto.ts`, and — found while confirming the first
three — `competition/dtos/setup.dto.ts`, `competition/services/pad.roller.ts`,
which was never registered as a provider, and
`competition/match/dtos/match_assignment.dto.ts`, whose only consumer was that
roller. The `MatchAssignment` entity stays; the match graph still loads it.

Three read endpoints no client calls, together with the chains that served them
and nothing else: `GET /divisions/:id` with `DivisionService.findOne` and
`findOneForView`; `GET /phase-groups/:id` with `PhaseGroupManager.findOne`; and
`GET /phases/:phaseId/phase-groups` with `PhaseGroupManager.findByPhase` and
`PhaseGroupService.findByPhase`.

`GET /phase-groups/:id/entrants` was listed as a candidate and kept. No client
calls it, but its end-to-end test is the only coverage of derived pool
membership, which phases 2 and 7 refactor. It is removed in phase 7, once
`PhaseGroupQueries` gives that test something else to assert through.

Verification passed: `tsc --noEmit`, `npm run build`, `npm run lint` (four
pre-existing warnings, none in the changed files), 57 unit tests, 11
end-to-end tests against PostgreSQL, and `npm run check:architecture`.

### Phase 1 — Match read side (done)

`competition/match/match.queries.ts` holds `byId`, `byPhaseGroup` and
`byDivision`. They share one scope-parameterized query and one batched
advancement-rule query, so a read costs two queries whatever its scope holds,
against `1 + 2N` before — 81 for a forty-match pool.

The two child collections are aggregated into JSON in the database rather than
joined flat, which is what keeps one match to one row: a flat join multiplies
entrants by standings and moves the grouping back into JavaScript. The JSON
keys are the DTO field names, so the mapper is a copy rather than a
translation.

The three read routes call it, and `MatchManager.GetMatchForView` delegates to
`byId`, so a write that answers with a match returns the projection its `GET`
returns. `MatchManager` keeps the write paths for phase 2. `toMatchListDto`,
both list methods and the two `*ForView` list loaders are gone.

Verification passed: `tsc --noEmit`, `npm run build`, `npm run lint` (four
pre-existing warnings, none in the changed files), 57 unit tests, 17 end-to-end
tests against PostgreSQL — six of them new, covering every branch of the
projection and the query count of a pool read — and
`npm run check:architecture`.

### Phase 2 — Match write side (done)

`match.aggregate.ts` holds the rules and no dependencies, `match.store.ts` the
one graph definition and the one transaction that puts it back, and
`match.commands.ts` the order of the steps. They absorbed `MatchManager`,
`MatchWorkflowManager`, `StandingManager`, `MatchResultService`, `RoundService`,
`StandingService` and the write half of `MatchService`: about 900 lines, each
layer of which reloaded what its caller already held.

`assertEditable`, the commit points, the round-settled rule and the
song-versus-hand-scored rule are aggregate methods, so they are unit-tested
without a database — the two mock-driven manager specs became one aggregate spec
of thirty cases.

The store's graph reaches the tournament, so a write publishes an address it
already holds. `UiUpdateContextService` lost its match lookup and the publisher
gained `emitMatchUpdate`; the rest of the context service still serves the
aggregates that have no store yet and goes with the last of them, rather than in
this phase as first written. The start.gg reporter is handed the loaded match
for the same reason, which is what brought the commit down to one load.

Every mutation answers with `MatchQueries.byId`. That now includes creation and
update, which previously answered with a bare entity carrying neither
`advancementRules` nor `phaseGroupId` while the client already declared it was
reading a projection; the other routes were unchanged.

Four departures from the plan as written, each of which stands until the phase
that resolves it:

- `applyCompletedSong` is not a command. `CompletedSongService` ingests inside
  its own transaction and produces warnings alongside its effect; moving it
  belongs with the `syncstart/` split, and its copy of the ranking rule stays
  until then. `StandingManager.applyPlayedScore`, the entry point it replaced,
  was dead and was removed.
- `addEntrant` and `removeEntrant` are commands, because the bracket systems
  fill a match one entrant at a time while building it. Fourteen commands, not
  thirteen.
- `MatchQueries` took in the two reads left stranded in `MatchService`:
  `pendingCountsByPhaseGroup`, which phase 5 folds into `TreeQueries`, and
  `exists`, which the advancement rules make. No service remains between a
  controller and a match.
- The file moves were deferred and then made, in their own commit once the
  phase had been verified, under the rule that a phase leaves what it touched
  in the target layout. The fear of moving them twice held for one file of
  five: phase 3 does not relocate `match.controller.ts`, `rounds.controller.ts`,
  `rounds.requests.ts` or `match.requests.ts` — it takes one response type out
  of the last of them — and it deletes `match-list.dto.ts` outright once its
  types live in `@tournament-manager/contracts`. A delete is not a second move,
  and leaving it behind would have kept `dtos/` alive for one file.
  `competition/standing/` is gone: a round is a match being scored, not a
  directory of its own.

Verification passed: `tsc --noEmit`, `npm run build`, `npm run lint` (four
pre-existing warnings, none in the changed files), 70 unit tests — thirteen more
than before, and none of them mocking a service to reach a rule — 26 end-to-end
tests against PostgreSQL, nine of them new, and `npm run check:architecture`.
The last of the new tests counts loads of the match graph: writing one score and
committing a result each load it once, against five for the commit before.

### Phase 3 — Shared contracts (done)

`@tournament-manager/contracts` holds every response type both workspaces
speak, in nine files behind its entry point: the vocabulary the responses
branch on, the three projections of a competitor, and one file per subject.
The five DTO files that declared responses under `apps/api/src` are gone, and
`tournament.dto.ts` and `match.requests.ts` keep only their requests.

`tournament/shared/projections.ts` writes player, participant and entrant
once. There were four copies — `DivisionManager.findSummary`,
`TournamentManager.findOverview` and `toParticipantDto`, and
`PhaseGroupManager.toEntrantDto` — and the three DTOs they mapped into were
identical. `MatchQueries` does not call them: it builds the same JSON in the
database, against the field names of the same types, which is what keeps a
list of matches to one query.

The frontend's seventeen redeclarations became imports. The shapes already
agreed, so almost every consumer compiled unchanged; the three that did not
were defects rather than naming differences.

- `SeedingTab` sorted the division roster by a `seedNum` the summary
  projection has never carried, so the tab has always opened alphabetically.
  The dead key is gone and FQ-015 asks whether the seed belongs in that read.
- `CommitMatchResultResponseDto.match` was optional because
  `MatchQueries.byId` is. A commit answers with the match it committed.
- The statistics page reads the raw entity dump of `GET /divisions`, four
  levels deep, and was typed as a division summary. It has its own type,
  stating the fields it reads, until phase 5 replaces that endpoint.

Four departures from the plan as written:

- Contracts gained one dependency, `@tournament-manager/scoring`, so that
  `ScoringSystemType` stays declared once rather than being copied into the
  package that every client reads. Scoring has no dependencies of its own and
  now builds first. The unions the persistence entities own — statuses, kinds,
  states — were not taken the same way: the browser must not depend on
  TypeORM, so contracts declares them and the API's projections are checked
  against them where they map a row.
- `SongDto`, `ScoreDto` and `PlayerRefDto` describe routes that still answer
  with entities, so nothing on the API asserts them yet. They state what the
  interface reads; phase 5 makes the API produce them.
- The frontend's `features/*/types/` modules re-export the contracts under the
  names their consumers already use, rather than every consumer importing the
  package. Phase 4 collapses those modules into `model/types.ts`, and
  rewriting eighty-two import lines twice is the churn this plan avoids.
- `tournament.dto.ts` was emptied but not moved. Phase 8 already claims the
  move of what remains, which is a request DTO, together with the barrel that
  re-exports it.

Verification passed: `npx tsc --noEmit` in both workspaces, `npm run build`
across every workspace, `npm run lint` (four pre-existing warnings in the API
and six in the frontend, none in the changed files), `npm run test:contract`,
126 unit tests, 27 end-to-end tests against PostgreSQL, and
`npm run check:architecture`, which now records the two new edges: contracts
on scoring, and the frontend on contracts.

### Phase 4 — Frontend api, model, ui

One feature at a time, one branch each. Every slice creates the API modules the
feature is missing, empties the `.tsx` files that import `axios`, moves what it
touched into `api/`, `model/` and `ui/`, and moves that feature's pages under
`src/pages/` mirroring the router.

Verification per slice: the grep rules pass for the feature, `npx tsc
--noEmit`, `npm run lint`, `npm run build` across every workspace, the unit
suites, and a manual UI check.

#### Tournament (done)

`features/tournament/` had seven directories and now has three. `api/` holds
`tournament.api.ts`, `lobbies.api.ts`, `startgg.api.ts` and
`tournament.keys.ts`; `model/` holds the hooks, the contexts, the view types
and the pure functions; `ui/` holds everything that renders. The seven pages
moved to `src/pages/tournament/` and lost the prefix the directory now carries,
and `TournamentLayout` folded into `TournamentPage`, which is the layout route.

- The five modules under `features/tournament/types/` became one
  `model/types.ts`. Twelve re-exports nothing imported went with them —
  `TournamentOverviewPhase`, `TournamentOverviewDivision`,
  `TournamentOverviewPlayer` and the start.gg preview sub-shapes.
- `useTournamentConfigurationPage` and `useTournamentParticipantsPage` took
  362 and 356 lines down to 184 and 233 of JSX. `useTournamentStructureDialogs`
  and `usePublicTournamentsQuery` did the same for the structural dialogs and
  the tournament list, so no `.tsx` in the feature fetches.
- The public tournament list became one shared query. The home page and the
  search dialog asked for it separately, twice per visit to the home page.
- The lobby list stopped redeclaring `SyncStartLobbiesDto` and reads the
  contract.
- `recentTournaments`, `treeState` and `themePreference` moved to
  `shared/lib/`, where the target layout puts persisted local state.

Three departures from the plan as written:

- `bracket/bracket-types`, `divisions/:id/generate-bracket` and
  `matches/scoring-systems` are called from tournament components but belong to
  other features, so they joined `divisions.api.ts` and `matches.api.ts` rather
  than a tournament module. That also removed the second copy of the
  scoring-system request in the create-match modal.
- `matches.keys.ts` and `divisions.keys.ts` were declared in this slice rather
  than in the match and division slices. `TournamentUpdatesContext` is the
  writer of those keys and this feature owns it, so leaving them inline would
  have left the defect rule 3 exists to close. Both files stay in `services/`
  until their own slice moves them into `api/`.
- `song.api.ts`, `account.api.ts` and `roles.api.ts`, listed here originally,
  belong to the song, account and auth slices and are created there.

#### Match (done)

`features/match/` had six directories and now has three. `api/` holds
`match.api.ts` and `match.keys.ts`, which the tournament slice declared and left
in `services/`; `model/` holds the hooks, the pure functions and the view types;
`ui/` holds everything that renders, with `row/` flattened into it and
`bracket/` and `round-robin/` kept. The feature has no pages of its own —
`DivisionMatchesPage` hosts it and moves with the division slice.

- The five modules under `features/match/types/` became one `model/types.ts`.
  Six re-exports nothing imported went with them — `MatchResult`,
  `MatchResultPlayerPoints`, `Standing`, `StandingScore`, `StartggReportStatus`
  and `isHandScored` — and `Score`, still declared by hand against `Player` and
  `Song`, became the `ScoreDto` the contracts package already carries. That was
  the eighteenth redeclaration, which phase 3 missed because the file it lived
  in declared interfaces rather than re-exporting them.
- `StandingModal` fetched the scores a player already registered from a
  `useEffect` in its `.tsx`. `useStandingModal` holds that list, the typed
  percentage, and the rule that the two are exclusive; the modal is 152 lines of
  JSX. No `.tsx` in the feature fetches.
- The advancement editor's wider match list was fetched twice, in
  `ConnectedMatchCard` and in `MatchList`, each spelling the query key and the
  request inside a `.tsx`. `useAdvancementTargets` states it once.

Two departures from the plan as written:

- `song.api.ts` was created here rather than in the song slice. Two match hooks
  addressed `songs` with their own `axios.get`, and the songs belong to the song
  feature, so the request is declared once in `features/song/api/song.api.ts`
  and the match hooks ask for the catalog. The song feature's own three copies
  go when its slice moves its hooks; `listSongs` is what they will call.
- `matches.reducer.ts` and `matches.actions.ts` moved to `model/` as
  `matchesReducer.ts` and `matchesActions.ts` rather than disappearing. Phase 6
  owns the removal of the reducer, and dropping it here would have put a change
  of update path inside a layout slice.

`MatchList` and the two parked views it renders — the bracket tree and the
round-robin table — are still unreferenced. They were left in place deliberately
when the list row took over match state, and moving them keeps that decision
where it was rather than settling it inside a layout slice.

#### Division (done)

`features/division/` had ten directories and now has three. `api/` holds
`division.api.ts`, `division.keys.ts`, `phase.api.ts` and `phase-group.api.ts`;
`model/` holds the hooks, the page context, the pure functions and the view
types; `ui/` holds everything that renders. The four pages moved to
`src/pages/tournament/division/` and lost the prefix the directory now carries,
and `DivisionLayout` folded into `DivisionPage`, which is the layout route.

- The four modules under `features/division/types/` became one `model/types.ts`.
  Two exports nothing imported went with them: `GenerateBracketResult` and
  `PhaseGroupEntrant`.
- `useDivisionPage` and `useDivisionStandings` addressed the API with their own
  `axios.get` while `divisions.api.ts` sat beside them. `getDivisionSummary` and
  `listDivisionStandings` are declared with the other division requests.
- `useDivisionMatchesPage` took the match list page from 297 lines to 186 of
  JSX. What it holds is state about the page rather than about a match: the
  scope the tree opened, the pool grouping, the open match and the pool
  advancement editor.
- `createDivision` and `renameDivision` answer `void`. They declared a
  `DivisionSummary` type for a body neither caller reads, and the name collided
  with `DivisionSummaryDto`, which is a different shape entirely.
- `poolViewMode.ts` moved to `shared/lib/`, beside `treeState` and
  `themePreference`.

One departure from the plan as written:

- `useDivisionStandings` still keeps its rows in `useState` and refetches on the
  realtime version counters rather than reading the query cache under a declared
  key. Converting it is a change of update path, which is phase 6, and doing it
  here would have put that change inside a layout slice.

#### Song, live, auth and participant (done)

The four remaining slices, on one branch each in that order.

**Song.** `api/song.api.ts` already existed — the match slice created it for
`listSongs` — and gained `createSong` and `deleteSong`, which were written
inline in whichever hook needed them. The songs list had been requested with a
hand-written `axios.get` in four places, each spelling the `tournamentId` query
string itself. The bulk import and the pack delete keep their loops: there is no
batch route, and per-row results are what lets the import report how many
succeeded. `types/Song.ts` became `model/types.ts` and gained
`CreateSongRequest`.

**Live.** `model/` holds the gateway, the message types and the three hooks;
`ui/` holds the panels. There is no `api/`: the feature reads a websocket and
never makes an HTTP request, so an empty directory for the rule's sake would say
something untrue about it.

**Auth**, absorbing `admin` and `PermissionContext`. `api/` holds
`auth.api.ts`, `account.api.ts` and `roles.api.ts`; `model/` holds the two
contexts, the reducer, the hooks and the types; `ui/` holds the one component
`features/admin` contained. Three `.tsx` files reached the server directly — the
account page patched its own profile, the roles page listed accounts and flipped
their flags, and the permission context asked for the account's roles — and are
now `useAccountInfoPage`, `useManageRolesPage` and a request module.
`PermissionContext` came out of `shared/services/`, which no longer exists: it
reads the signed-in account and answers what that account may do, which is the
auth feature's own question rather than a shared utility. `Account.ts` came out
of `features/player/types/`, where it had nothing to do with a player. The two
pages moved to `src/pages/account/` and `src/pages/admin/`.

**Participant**, absorbing `player`, `entrant` and `advancement`. None of the
three was an area of the application; each was a noun that happened to have a
file. `participant/api/` takes the player and participant requests and
`participant/model/` the entrant types, with `entrantPlayer` and `entrantPlayers`
in `model/entrant.ts` rather than in a module named `types`. `advancement` went
to `match` instead: its request and its editor are both about where a match
sends its finishers, and the rule types were already declared there.

Two departures from the plan as written:

- `app/providers.tsx` was created in this slice. `main.tsx` configured the axios
  base URL, the bearer interceptor and the query client inline, which was the
  last `axios` import in a `.tsx`. The target layout names the file and no phase
  claimed it, so finishing the tree here was cheaper than carrying the last rule
  violation to phase 8.
- `features/live/model/types.ts` still redeclares what the realtime gateway
  sends. Those shapes are not the syncstart contracts — the gateway flattens
  `song` into `songTitle` and `songPath` — and `apps/realtime` declares the
  flattened form a second time, as `LiveMatchState` with `players: unknown[]`.
  Putting them in `@tournament-manager/contracts` would make a phase 4 slice
  span three workspaces, which is the rule phase 6 is the stated exception to.
  It is recorded here for phase 8.

### Phase 5 — Remaining read models

The HTTP contract changes here.

- Add `TreeQueries`, `StandingsQueries`, `DivisionQueries`,
  `ParticipantQueries`, `TournamentQueries`, `SongQueries` and `ScoreQueries`.
- Collapse `TournamentOverviewDto` and `DivisionSummaryDto` into one projection
  parameterized by scope, and drop the always-empty `entrants: []` field on a
  pool.
- Update the frontend callers in the same change.
- Verification: end-to-end tests updated to the new contract.

`GET /divisions?tournamentId=` was to be replaced by
`GET /tournaments/:id/standings`. It is removed instead, and no read model takes
its place. Its only consumer was the statistics page, which downloaded the whole
tournament graph and recomputed the totals in the browser; what a tournament's
statistics should show is a question nobody had answered, and building the query
first would have answered it by accident. The page is empty, the endpoint,
`DivisionService.findAll` and `findAllForTournamentCards` are gone, and FQ-016
holds the question. This also leaves `division.entrants` in the overview
projection with no frontend consumer, which is a candidate for the collapse
above rather than a separate change.

The phase is subdivided one branch per read model, the way phases 4 and 7 are.
Each slice changes the contract of the routes it takes over and moves their
frontend callers in the same branch, so a slice that merges leaves both
workspaces speaking the same shapes. `TreeQueries` and the projection collapse
come last, because the tree is the read every other one narrows away from.

#### Tournament (done)

`management/tournament.queries.ts` holds `byId`, `configuration`, `publicList`,
`hasStartggApiKey` and `rolesFor`. Four are `find({ select })`; `rolesFor` is the
one SQL query, replacing two query-builder reads of the same four-table join
that differed only in the role they matched, and matching a role as an element
of the stored `simple-array` rather than as a substring of it.

Every write of a tournament answers with `byId`, so `TournamentManager` no
longer maps the record at all. `TournamentService` keeps its write side and
`findSongsByTournamentId`, which goes with `SongQueries`.

Two contract changes. `TournamentDto` lost `staff`: no loader behind the mapping
ever populated `tournament.participants`, so the array was empty in every
response the API has sent, and no client read it — FQ-017 asks whether it should
come back. `GET /tournaments/public` answers `TournamentRefDto[]`, which is what
it already selected and all its two consumers read.

One departure: `tournament.service.ts` and `tournament.manager.ts` stay under
`services/`. Phase 7 gives Tournament its four roles, and the manager still holds
the participant write paths that belong to `registration/`; moving the pair into
`management/` now would move them again one phase later and split them wrongly
in between.

### Phase 6 — One update path

- Mutations answer `204`.
- The frontend drops the reducer in `useMatches` and relies on the query cache.
- Narrow the realtime invalidation to what an event actually touches, using the
  address already carried in the envelope.
- Verification: one score entry produces one refetch instead of four; a
  disconnected client still converges after reconnection.

This phase and the frontend change are the same change seen from two sides and
must ship together.

### Phase 7 — Remaining aggregates

- Give Division, PhaseGroup, Tournament and Song the same four roles.
- Move `syncDerivedEntrants` into PhaseGroup commands and bracket generation
  into Division commands.
- Perform the directory moves for each aggregate immediately before refactoring
  it, so a reviewer sees the move in one commit and the change of roles in the
  next.

### Phase 8 — File tree and naming

What the aggregate phases cannot carry, because it belongs to no aggregate.

- Rename `bracket/` to kebab-case and split it into `bracket.controller.ts`,
  `bracket.commands.ts` and `systems/`. `IBracketSystem` becomes
  `bracket-system.ts`.
- Delete the barrels: `tournament/dtos.ts`, `account/dtos.ts`, `auth/guards.ts`
  and `auth/strategies.ts`. Phase 3 empties the first of its response types;
  what remains are request DTOs, which move beside their controller.
- Create `shared/` and move `tournament-open.guard.ts`,
  `ui-update.publisher.ts` and the common projections into it. The publisher
  currently lives under `competition/match/services/`, where six files outside
  the match aggregate import it from.
- Move `song.service.ts`, `song.roller.ts` and the songs and scores controllers
  into `catalog/`.
- Mirror `tests/unit` onto the final source tree.
- Move the realtime gateway's message shapes into
  `@tournament-manager/contracts`. `features/live/model/types.ts` and
  `apps/realtime/.../realtime-event.mapper.ts` declare the same flattened
  projection twice, the second time as `players: unknown[]`.
- Verification: build, lint, and every suite. No behaviour change anywhere in
  the phase.

### Phase 9 — Freeze

- Add the grep checks to CI.
- Fold the rules from this document into [Backend.md](Backend.md) and
  [Frontend.md](Frontend.md), and reduce this document to its record of
  decisions.

## What success looks like

- One loader definition per aggregate, in its store.
- No service call inside a loop over a collection.
- One aggregate load per command.
- Eleven named SQL queries, each beside the function that maps its rows.
- Response types declared once, in `@tournament-manager/contracts`.
- `axios` in `features/*/api/` only.
- One update path from a write to the interface.

## Open questions

- `apps/api/tsconfig.json` sets `strictNullChecks: false` and
  `noImplicitAny: false`. Raw SQL projections rely on hand-written row types, so
  an unexpected `null` from a `LEFT JOIN` passes unnoticed. Enabling strict null
  checks is out of scope here and belongs in
  [FunctionalQuestions.md](FunctionalQuestions.md).
- Whether `Phase` deserves its own aggregate or remains part of the structure
  aggregate alongside Division and PhaseGroup is decided in Phase 7, when its
  commands are collected in one place.
