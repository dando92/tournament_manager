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
| 13 | `AdvancementRollbackGuard.blockingMatches` loads a full match aggregate per target inside a loop | `PROGRESSED_MATCHES`: one query over all target ids, joining `match_entrants_entrant` for the membership test and reusing the progressed predicate written a few lines below in the same file | Done |
| 14 | `AdvancementRollbackGuard.blockingPhaseGroups` loads a full pool aggregate per target only to test `seat.sourceAdvancementRule?.id` | `SEATS_TAKEN_BY_RULES`, one lookup on `phase_group_entrant` for every target at once, then the existing `PROGRESSED_POOLS` over what it returns | Done |
| 15 | `ControlRoomQueries.byId`, `creation` and `editor` each project every match of the tournament | `MatchQueries` gained an `'ids'` scope and `byIds()`; `byId` asks for its flow's entries, and the other two for the matches they offer | Done |
| 16 | `TournamentOpenGuard` issues two queries on every mutating request: resolve the tournament, then read its status | Each entry of `TOURNAMENT_OF` selects `t."id"` and `t."status"` through the join to `tournament`; one round trip | Done |
| 18 | `TreeQueries` recomputes the division entrant count once per pool, because the lateral sits in the query that returns one row per pool | `ENTRANT_COUNTS_IN_SCOPE`, aggregated by `divisionId`, the way `progressed` and `pending` already are | Done |

Item 14 depends on `phase_group_entrant(phaseGroupId)` from batch B to be worth
doing.

What the rewrites had to preserve, and how:

- **Item 13 pairs its ids.** A target is affected only when it holds the entrant
  *its own* rule put there. Two flat arrays would let a match blocked by one
  rule be matched against an entrant impacted by another, so the target ids and
  the entrant ids arrive as `unnest($1::int[], $2::int[])` and the join tests
  the pair. The progressed predicate is the same evidence
  `MatchAggregate.poolState` computes in memory — a committed result, or a
  standing with a score or a hand-scored point — which is what makes the
  aggregate load unnecessary rather than merely expensive.
- **Item 15 keeps the offered set in SQL.** `creation` and `editor` used to
  project every match of the tournament and subtract the assigned ones in
  memory. `UNASSIGNED_MATCH_IDS_OF_TOURNAMENT` does the subtraction as a
  `NOT EXISTS` over ids, and only the matches actually returned are projected.
  `forTournament` still reads the tournament, because it answers about every
  flow of it at once.
- **Item 16 keeps both 404s.** Resolving and reading the status in one query
  collapses "cannot resolve" and "not found" into one empty result, so the guard
  chooses the message the two-query form produced: a reference to a tournament
  that does not exist still says `Tournament with id X not found`, and every
  other unresolvable reference still says `Cannot resolve a tournament for ...`.
- **Item 18 resolves the division first.** The entrant count cannot join the
  pools it is scoped by without multiplying each entrant by them, so the pool
  scope resolves its division in a scalar subquery and the count groups by
  `divisionId`.

`control-room.e2e-spec.ts` gained the case items 15 covers, because the creation
form and the editor had no e2e coverage before: a match held by a flow is not
offered, one that is free is, and the editor answers with the same set plus its
own entries.

## G — Connection configuration

| # | Finding | Resolution | Status |
| --- | --- | --- | --- |
| 29 | `app.module.ts` sets nothing on `extra` | Pool `max` 10, `statement_timeout` 15 s, `idle_in_transaction_session_timeout` 30 s, `application_name` `tournament-manager-api`, each overridable through the environment | Done |
| 30 | No visibility into slow queries | `maxQueryExecutionTime`, 500 ms by default, so batch E is measured rather than guessed | Done |

The defaults are deliberate rather than tuned: the API answers one request per
query and holds no long transaction, so fifteen seconds is far beyond anything
it legitimately does, and thirty seconds of an idle open transaction only ever
means a handler died holding locks. The four settings and the slow-query
threshold are `DATABASE_POOL_MAX`, `DATABASE_STATEMENT_TIMEOUT_MS`,
`DATABASE_IDLE_TRANSACTION_TIMEOUT_MS`, `DATABASE_APPLICATION_NAME` and
`DATABASE_SLOW_QUERY_MS`, listed in `.env.example` and commented out at their
defaults.

Nothing in the application fails when these are dropped — a query simply runs
unbounded again — so `connection.e2e-spec.ts` asks the session what it actually
carries. The threshold logged nothing across the e2e suite, which is the point:
what it prints later is a query worth reading.

## E — SQL rewrites

Measure before rewriting.

| # | Finding | Resolution | Status |
| --- | --- | --- | --- |
| 19 | `ENTRANTS_OF_PHASE_GROUP` scans the whole `entrant` table: the `OR` between the seat test and the derived-entrant `EXISTS` leaves no restrictive predicate the planner can use | A `UNION ALL` of two branches — the pool's seats, and the entrants of the pool's own matches that hold no seat — each asked of the pool rather than of `entrant` | Done |
| 20 | `pendingMatchesInScope` uses five CTEs, materializes `match_player` because three references force it, and puts a correlated `EXISTS` inside a `LEFT JOIN ... ON` clause. It runs on every tournament overview load | Four CTEs, the correlated `EXISTS` replaced by a join to `match_player`, and the round and match levels aggregated in one pass each | Done |
| 21 | The `phase_group → phase → division → tournament` chain is written out eight times across four files | The `competition_address` view, created in `1788600000000-CompetitionAddressView`, used by both address queries, by `TournamentOpenGuard` below a pool, and by `activeConflicts` | Done |

### The database the numbers come from

A fresh database, migrated and seeded: 4 tournaments, 24 divisions, 48 phases,
480 pools, 19 200 matches, 1 536 competing entrants, 3 840 seats, 57 600 rounds
and 57 600 standings with a score each. Half the matches of every pool have been
played and a sixth of those have a committed result, so each tournament carries
a mix rather than an all-or-nothing. A fifth tournament of archived seasons
brings `entrant` to 21 536 rows without giving those entrants any matches —
which is exactly the shape item 19 is about: an installation accumulates
entrants, and a pool read must not grow with them.

`EXPLAIN (ANALYZE, BUFFERS)`, best of three, against that database:

| | Before | After |
| --- | --- | --- |
| `ENTRANTS_OF_PHASE_GROUP`, one pool of 22 | 31.3 ms, 511 buffers | 0.97 ms, 566 buffers |
| `pendingMatchesInScope('tournament')`, 4 800 matches over 120 pools | 113.7 ms, 12 501 buffers | 59.4 ms, 7 074 buffers |
| Address of one match | 10 buffers | 10 buffers |

Item 19 is the one the numbers argue for: the old plan read all 21 536 entrants
and discarded 21 514 of them, so its cost was the installation's roster rather
than the pool's. The new plan touches marginally more buffers and thirty times
less time, and the gap widens with every season the installation keeps.

Item 20 halves the work but no more than that, which is what the plan asked to
find out before promising anything. The shape that mattered was the correlated
`EXISTS` in the `LEFT JOIN ... ON`: as a join to `match_player` the membership
test is evaluated once per standing rather than once per standing per round.
A first attempt that expressed the same restriction as a parenthesized
`standing JOIN match_player` join was no faster and read 55 444 buffers, so it
was discarded.

Item 21 is duplication, not cost: the planner expands the view, so a lookup
through it produces the same plan and the same ten buffers the written-out
joins did. It is used only from a pool downwards — a division or a phase that
carries no pool has an address the view cannot show, so the guard still reaches
those directly.

Both rewrites were checked against their originals on the seeded database
before being applied: identical result sets for item 19 over four pools, and
for item 20 over five scopes covering two tournaments, a division and two
pools. `migration-runner.e2e-spec.ts` asserts the view addresses a pool with
matches and one without.

## F — Schema and types

The application is pre-production, so this batch prefers a clean baseline over
upgrade compatibility, per the policy in `AGENTS.md`.

| # | Finding | Resolution | Status |
| --- | --- | --- | --- |
| 22 | `match_result."playerPoints"` is `text` holding JSON, cast `::json` on every read | `jsonb`, which `staleDetails` and `interruptionDetails` already are; the cast is gone from the projection | Done |
| 23 | `participant."roles"` is a `simple-array`, unpacked with `string_to_array` in five queries, each guarded by `CASE WHEN COALESCE(roles, '') = ''` | Native `text[]`; the five reads take the column itself, and the guard is gone | Done |
| 24 | `ParticipantQueries.canEdit` is not sargable (`string_to_array(...) && ARRAY[...]`) | `pa."roles" && ARRAY['owner', 'staff']`, an operator on the column, plus `IDX_participant_roles` (GIN) | Done |
| 25 | The two name lookups are not sargable (`LOWER(TRIM("playerName"))`) | Resolved by 28: the unique expression index serves both lookups | Done |
| 26 | Nothing enforces one participant per person per tournament, a rule `TournamentStore` applies in memory | `UQ_participant_tournament_player` on `participant(tournamentId, playerId)` | Done |
| 27 | `score."percentage"` is unbounded `numeric` | `numeric(5, 2)` — see FQ-028 | Done |
| 28 | Nothing prevents two players whose names normalize to the same value, which `IMPORT_PREVIEW_OF_NAMES` itself calls a defect in the catalogue | `UQ_player_normalized_name` on `player (LOWER(TRIM("playerName")))` — see FQ-029 | Done |

Both unique indexes state a rule the application already believed, so neither
can be created over data that breaks it. The migration checks each first and
reports what collides — the normalized names and the row ids — rather than
failing on an index name, because the answer to a collision is a decision about
people, not about schema.

The composite covers `participant."tournamentId"` as its leading column, so
`IDX_participant_tournament`, created in batch B, was dropped with it.

Two of the three new indexes cannot be declared the way the convention asks.
TypeORM's decorator expresses neither an expression index nor a GIN one:

- `UQ_player_normalized_name` is invisible to the schema builder, which skips
  indexes over expressions, so it lives in the migration alone.
- `IDX_participant_roles` is visible, and an index the metadata does not declare
  is one the schema builder proposes to drop, so the entity declares it with
  `synchronize: false` — an option TypeORM reads but does not put on the type.
  Such an index carries no resolved columns in metadata, so
  `migration-runner.e2e-spec.ts` compares its name and table and leaves the
  columns to the schema.

That GIN index is insurance rather than a measured win: `canEdit` already
selects through `tournamentId` and `accountId`, which leaves it a role test over
almost nothing. It earns its place only for a read that asks about roles alone,
and it is one line to remove if that read never appears.

With the rule enforced, the three reads that used to resolve a duplicate stopped
guarding against one: `IMPORT_PREVIEW_OF_NAMES` joins the player rather than
taking the first row of a lateral, `PLAYERS_OF_TOURNAMENT_BY_NAME` drops its
`DISTINCT ON`, and `PlayerStore.byNormalizedNames` drops the ordering that
decided which of two rows won its map.

`migration-runner.e2e-spec.ts` covers what the two rules now refuse: a second
`dando` beside a `Dando`, and a second participation of the same person in one
tournament. It also covers what they allow — `Dandò` beside both, because
normalization stops at trimming and case.

`external_mapping."payload"` is still a `simple-json`. It was not part of this
review and no read unpacks it in SQL, so it stays as it is until one does.

Items 25 and 28 were the same index, and FQ-029 answered it: a normalized
player name is unique across the application, normalization being the trimming
and lowercasing the code already applies. `Dando` and `dando` are one person;
`Dan do` and `Dandò` are not. So the index is the unique one, 25 comes with it,
and both lookups stop resolving a duplicate they should never see. The
constraint cannot be added over a catalogue that already holds one, which the
pre-production reset policy covers.

FQ-028 answered item 27: a percentage carries two decimal places, so the column
is `numeric(5, 2)` — five digits, because `100.00` needs them — and a value
arriving with more precision is rounded rather than refused.

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
