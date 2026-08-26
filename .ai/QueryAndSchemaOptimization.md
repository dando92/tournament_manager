# Query and Schema Optimization

## The problem

Two lines of noise in the test output opened a review of every database access
in the API. The noise itself turned out to be shallow. What it uncovered
underneath is not.

**The schema has almost no indexes.** PostgreSQL does not index a foreign key
column on its own, and the initial migration never did it by hand. Nine indexes
exist in the whole schema, and nearly all of them were created to enforce a
unique constraint rather than to serve a read. `match."phaseGroupId"` — the
column behind every scope predicate in `MatchQueries`, `TreeQueries`,
`StandingsQueries` and the active-song lookups — has none. Neither does
`participant."tournamentId"`, `entrant."divisionId"`, or the whole of
`advancement_rule`.

There is a second, quieter cost. Almost every one of those foreign keys is
`ON DELETE CASCADE`. Without an index on the child column, each delete scans
the child table in full. Deleting a tournament today scans `division`, `phase`,
`phase_group`, `match`, `round` and `standing` end to end.

**One kind of query is written in two styles.** Ten files extract their SQL
into a module-level constant with a row type and a comment above it. Nineteen
other call sites hold the SQL inline in the function body, and two of those are
the same query written twice. The convention that produced the good form is
not written down anywhere, which is what let the other form come back.

**Some reads do work proportional to the wrong thing.**
`ENTRANTS_OF_PHASE_GROUP` carries no restrictive predicate on `entrant` at all,
so it grows with the number of entrants in the installation rather than with
the size of the pool. `ControlRoomQueries.byId` projects every match of the
tournament — rounds, standings, tiebreaks and scores included — to resolve the
entries of a single flow. Two guards load a full aggregate per target inside a
loop.

## How to work this plan

One batch per branch and per commit. Batches are independent except where the
order below says otherwise. Each item keeps the number it was given during the
review so it stays quotable in commits and follow-ups; the numbers are an
identity, not an order.

Execution order: **B, A, C, D, G, E, F.** B first, because it multiplies the
value of D and E — rewriting a query that still falls back to a sequential scan
measures nothing. G before E, because it is what makes E measurable.

## B — Foreign key indexes

One migration. No behavior change, no application code.

| # | Finding | Resolution | Status |
| --- | --- | --- | --- |
| 3 | Foreign key columns without an index | Index `match(phaseGroupId)`, `participant(tournamentId)`, `participant(playerId)`, `participant(accountId)`, `entrant(divisionId)`, `phase(divisionId)`, `phase_group(phaseId)`, `division(tournamentId)`, `song(tournamentId)`, `round(songId)`, `standing(playerId)`, `match_tiebreak(songId)`, `match_tiebreak_standing(playerId)`, `control_room_flow(tournamentId)`, `control_room_flow(currentEntryId)`, `phase_group_entrant(phaseGroupId)`, `phase_group_entrant(entrantId)`, `phase_group_entrant(sourceAdvancementRuleId)` | Done |
| 4 | `advancement_rule` carries no index at all | Composite `(sourceKind, sourceId)` and `(targetKind, targetId)` — the two legs of the `OR` in `ADVANCEMENT_RULES_FOR_MATCHES`, which can then use a bitmap OR instead of a sequential scan | Done |
| 5 | `ON DELETE CASCADE` without an index on the child column scans the child table once per parent delete | Resolved by the same index set; no separate work | Done |

Three of these look covered and are not. `IDX_76a9cb5154ea8d65024989a39e` is
`standing(roundId, playerId)`, so `playerId` alone cannot use it — and
`STANDINGS_OF_DIVISION` joins on exactly that column. The same applies to
`match_tiebreak_standing."playerId"` under `UQ_match_tiebreak_standing_player`,
and to `round."songId"` under `IDX_dfa041d32ed2f7a150188a2da7`.

Item 4 dropped in priority when automatic bracket generation moved out of
scope. The volume argument was that a 64-player single elimination writes about
126 rules per pool; with generation deferred, the table stays small. The two
indexes are two lines in the same migration and still cover hand-written rules,
so they stay in this batch — cheap insurance now, rather than a hot fix.

Follow the existing convention: declare each index on the entity with `@Index`
**and** create it in the migration under the name TypeORM derives, so schema
and metadata agree. `StandingOwnsPlayer1787700000000` and `Score` are the
precedents.

Verification, measured on the same seeded database — 42 240 matches, 5 280
pools, 11 520 rounds, 46 080 standings — with the index set dropped and then
recreated, `EXPLAIN (ANALYZE, BUFFERS)` either side:

| | Without | With |
| --- | --- | --- |
| `matchesInScope('tournament')` | 3.876 ms, 401 buffers | 0.127 ms, 152 buffers |
| `STANDINGS_OF_DIVISION` | 5.137 ms, 14 226 buffers | 1.882 ms, 2 905 buffers |
| `DELETE FROM tournament WHERE id = $1` | 30.1 ms | 10.9 ms |

Every sequential scan on `match`, `phase_group`, `phase` and `division` in
those plans became an index scan.

`migration-runner.e2e-spec.ts` now asserts the agreement the convention asks
for: every index the entity metadata declares exists in the migrated schema
under the same name, on the same table, over the same columns in the same
order. That is what keeps the next index from being declared in one place
only.

## A — Test output noise

| # | Finding | Resolution | Status |
| --- | --- | --- | --- |
| 1 | Six `console.log` calls in the bracket generators | Four were a trace of the loop and are gone. The two that record a decision — the byes added to round the bracket up — became `Logger.debug` on a logger named after the system | Done |
| 2 | `DeprecationWarning` from `pg`, twelve times across the e2e suite | `apps/api/tests/global-setup.ts` wraps `process.emitWarning` and drops only this message. The `pg@9` risk is recorded below as tracked debt | Done |

Item 1 stays in this batch even though the calls live in the bracket
generators, which are otherwise deferred: that code still runs in the e2e suite,
and the noise is what prompted the review.

The filter does not belong in `setup-env.ts`, where the plan first put it.
Jest hands each test sandbox a deep copy of `process`, while `util.deprecate`
emits on the real one; patching the copy changes nothing, and the warning still
printed. The global setup runs in the Jest process itself and shares the real
`process`, so the patch takes effect there. `maxWorkers: 1` keeps the suite in
band, so no worker process escapes it — were that to change, the warning would
come back rather than anything breaking.

The full e2e suite now prints sixteen `PASS` lines, the test names and the
summary, and nothing else. The unit suite still prints Nest logger output from
`StartggMatchReporter`, which is a separate question and outside this batch.

### What the deprecation warning actually is

Worth recording, because the stack does not appear without asking for it and
the obvious reading of the message is wrong.

Re-running the suite with `NODE_OPTIONS=--trace-deprecation` produces twelve
occurrences — one per test file, because `util.deprecate` warns once per module
registry and Jest resets that per file. Every one of them originates inside
TypeORM, at two places:

- `SubjectDatabaseEntityLoader.load` through `RelationIdLoader` (nine), which
  loads the relation ids of the entity being saved in parallel;
- `SubjectExecutor.executeUpdateOperations` (three), which runs the subject
  `UPDATE`s under `Promise.all`.

Both issue several queries concurrently on the same client, the one held by the
transaction, and `pg` has warned about that since 8.19.0 — verified by
unpacking 8.16 through 8.23. The project resolves 8.23.0 from `^8.13.3`.

The application entry points are only three, all `manager.save(Entity, aggregate)`
inside `dataSource.transaction`: `DivisionStore.save` (eight),
`TournamentStore.save` (three), `MatchStore.save` (one).

**No hand-written SQL in this repository causes it.** Every `dataSource.query`
call takes its own client from the pool and never triggers it. Do not pin `pg`
backwards to silence the message; it is harmless today, and becomes a real
break at `pg@9` if TypeORM 0.3.x is not fixed upstream first.

## C — One query style

No behavior change.

| # | Finding | Resolution | Status |
| --- | --- | --- | --- |
| 6 | Nineteen inline queries across ten files | Extracted to module-level `SCREAMING_SNAKE` constants with a row type and a comment, in the form the conforming `*.queries.ts` files already used | Done |
| 7 | The assigned-match-ids query is written twice, identically, in `control-room.queries.ts` | One `ASSIGNED_MATCH_IDS_OF_TOURNAMENT`, read by both the creation form and the editor | Done |
| 8 | `MatchQueries.activeSongForTournament` builds its SQL as `${ACTIVE_TOURNAMENT_SONGS_BASE} AND ...`, which works only because the base happens to end in a `WHERE` | `ACTIVE_TOURNAMENT_SONGS` and `ACTIVE_TOURNAMENT_SONG`, each complete, each wrapping the named base | Done |
| 9 | The convention is not written down | Written down in `.ai/Backend.md`, under **How hand-written SQL is written** | Done |
| 10 | `exists()` selects `id` in three files | `SELECT 1`, and the caller reads `rows.length` against an `unknown[]` | Done |
| 11 | `matchesInScope(scope)` and the other scope builders rebuild the string on every call | The builders take a predicate, and a `Record<Scope, string>` beside each holds the finished queries, built once at module load | Done |
| 12 | `ACTIVE_TOURNAMENT_SONGS_BASE` filters by tournament outside the `UNION ALL` | Filtered inside both branches, which also let the wrapper and its carried `tournamentId` column go | Done |

The inline call sites were: `control-room.queries.ts` (3),
`control-room.runner.ts` (5), `control-room.store.ts` (1),
`control-room-mutation.guard.ts` (2), `tournament-open.guard.ts` (1, plus the
seven in its `Record`), `advancement-rollback.guard.ts` (1),
`match.queries.ts` (1), `division.queries.ts` (2), `phase-group.queries.ts` (2),
`participants.queries.ts` (1). They are now eighteen named constants — eighteen
rather than nineteen because of item 7 — plus `TOURNAMENT_ID_OF`, which keeps
the guard's seven walks as a `Record` because that is what its caller indexes.

Item 9 is the one that keeps the rest from regressing. The rule as written also
covers the two forms this batch removed: no fragment concatenated onto a call
site, and no query rebuilt per call.

Two things were tidied along the way rather than left half-converted. The
identifiers in the extracted SQL are now quoted and aliased the way the
conforming files quote them, so `JOIN match ON match."phaseGroupId" = pg.id`
reads as `JOIN "match" m ON m."phaseGroupId" = pg."id"`. And the extracted
control-room and guard queries kept their semantics exactly; the e2e suite,
which covers every one of these routes, passes unchanged.

## D — Round trips and N+1

Behavior is preserved, but this batch touches domain logic and wants careful
review.

| # | Finding | Resolution | Status |
| --- | --- | --- | --- |
| 13 | `AdvancementRollbackGuard.blockingMatches` loads a full match aggregate per target inside a loop | One query over all target ids: join `match_entrants_entrant` for the membership test, and reuse the progressed predicate already written a few lines below in the same file, returning id, name and reason | Open |
| 14 | `AdvancementRollbackGuard.blockingPhaseGroups` loads a full pool aggregate per target only to test `seat.sourceAdvancementRule?.id` | `SELECT DISTINCT "phaseGroupId" FROM phase_group_entrant WHERE "phaseGroupId" = ANY($1) AND "sourceAdvancementRuleId" = ANY($2)`. Two round trips per target become two in total | Open |
| 15 | `ControlRoomQueries.byId`, `creation` and `editor` each project every match of the tournament | Add an `'ids'` scope to `MatchQueries` (`m."id" = ANY($1::int[])`) and expose `byIds()`; the three methods then ask only for the matches they reference | Open |
| 16 | `TournamentOpenGuard` issues two queries on every mutating request: resolve the tournament, then read its status | Each entry of the `Record` also selects `t."status"` through the join to `tournament`; one round trip | Open |
| 18 | `TreeQueries` recomputes the division entrant count once per pool, because the lateral sits in the query that returns one row per pool | Move it out as a query aggregated by `divisionId`, the way `progressed` and `pending` already are | Open |

Item 14 depends on `phase_group_entrant(phaseGroupId)` from batch B to be worth
doing.

## G — Connection configuration

| # | Finding | Resolution | Status |
| --- | --- | --- | --- |
| 29 | `app.module.ts` sets nothing on `extra` | Pool `max`, `statement_timeout`, `idle_in_transaction_session_timeout`, `application_name`. Without a statement timeout, one pathological query holds a connection indefinitely | Open |
| 30 | No visibility into slow queries | `maxQueryExecutionTime` on the TypeORM options, so batch E is measured rather than guessed | Open |

## E — SQL rewrites

Measure before rewriting.

| # | Finding | Resolution | Status |
| --- | --- | --- | --- |
| 19 | `ENTRANTS_OF_PHASE_GROUP` scans the whole `entrant` table: the `OR` between the seat test and the derived-entrant `EXISTS` leaves no restrictive predicate the planner can use | A `UNION` of two branches — seated entrants, and entrants derived from the pool's matches — each with an indexable predicate | Open |
| 20 | `pendingMatchesInScope` uses five CTEs, materializes `match_player` because three references force it, and puts a correlated `EXISTS` inside a `LEFT JOIN ... ON` clause. It runs on every tournament overview load | `EXPLAIN (ANALYZE, BUFFERS)` against realistic data first. Direction: replace the correlated `EXISTS` with a join to `match_player`, and reduce the CTE count. No improvement is promised before the plan is in hand | Open |
| 21 | The `phase_group → phase → division → tournament` chain is written out eight times across four files | One SQL view in a migration (`tournamentId, divisionId, phaseId, phaseGroupId, matchId`), used by both address queries, by `TournamentOpenGuard`, and by `activeConflicts` | Open |

## F — Schema and types

The application is pre-production, so this batch prefers a clean baseline over
upgrade compatibility, per the policy in `AGENTS.md`.

| # | Finding | Resolution | Status |
| --- | --- | --- | --- |
| 22 | `match_result."playerPoints"` is `text` holding JSON, cast `::json` on every read | Migrate to `jsonb`, which `staleDetails` and `interruptionDetails` already are | Open |
| 23 | `participant."roles"` is a `simple-array`, unpacked with `string_to_array` in five queries, each guarded by `CASE WHEN COALESCE(roles, '') = ''` | Migrate to a native `text[]`; the guard disappears from all five | Open |
| 24 | `ParticipantQueries.canEdit` is not sargable (`string_to_array(...) && ARRAY[...]`) | Resolved by 23, plus a GIN index on `roles` | Open |
| 25 | The two name lookups are not sargable (`LOWER(TRIM("playerName"))`) | Expression index on `player (LOWER(TRIM("playerName")))` | Open |
| 26 | Nothing enforces one participant per person per tournament, a rule `TournamentStore` applies in memory | Unique index on `participant(tournamentId, playerId)` | Open |
| 27 | `score."percentage"` is unbounded `numeric` | Needs a decision — see FQ-028 | Blocked |
| 28 | Nothing prevents two players whose names normalize to the same value, which `IMPORT_PREVIEW_OF_NAMES` itself calls a defect in the catalogue | Needs a decision — see FQ-029 | Blocked |

Items 25 and 28 are the same index. If the normalized name becomes unique, 25
comes for free.

## Deferred

| # | Finding | When to pick it up |
| --- | --- | --- |
| 17 | Bracket generation is fully sequential: matches created one at a time, entrants added one at a time with an aggregate reload and save each, and advancement rules written in a nested loop despite `AdvancementRuleStore.createAll` already existing and being documented for exactly this. A 64-player single elimination costs over 250 sequential transactions, each with its own UI event publish | When automatic bracket generation comes back into use. Related: [FQ-008](FunctionalQuestions.md) already defers what generation should produce, so the shape of this code may change before the batching is worth writing |

## What success looks like

- The e2e suite prints test results and nothing else.
- Every foreign key column that a read joins on, or that a cascade deletes
  through, has an index — declared on the entity and created in a migration
  under the name TypeORM derives.
- SQL lives in one place and one form: a named module constant with its row
  type beside it, and the rule stated in `.ai/Backend.md`.
- No read loads an aggregate inside a loop, and no read projects a whole
  tournament to answer a question about one flow.
- Slow queries are visible rather than inferred.
