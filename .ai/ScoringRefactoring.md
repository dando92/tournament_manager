# Scoring Model Refactoring

## The problem

A match produces points per player. Today it produces them along two unrelated
paths.

A match with songs produces them through the model: match to rounds to
standings, where the scoring provider ranks the percentages of a round and
writes the points of each standing. A match without songs produces them outside
the model: the points are typed into `localStorage`, travel in the body of the
commit request, and are written straight into `MatchResult` by a dedicated
branch of `resolvePlayerPoints`.

The second path exists because the first one has no room for it. A standing
requires a score, a score requires a song, and a match scored by hand has no
song. Having nowhere to live, hand-scored points went outside the database
entirely, and every consequence follows from that: two operators diverge
silently, the sidebar cannot mark a match that is waiting, the division
standings ignore hand-scored results, and the definition of "ready to commit"
has to be repeated wherever the two paths are told apart.

## The model

**A standing is the points of one player in one round. A score is the evidence
behind them, when there is one.**

- A **round with a song** is a played song. Its standings carry a score, and
  their points come from the scoring provider ranking that round's percentages.
- A **round without a song** is a stated result. Its standings carry no score,
  and their points are written by a person.

Nothing downstream asks which kind it was. The match result, the division
standings, the progress of a match, the commit rule and the sidebar roll-up all
read `standing.points`.

One question does depend on the kind, and it is asked in three places that have
to agree: when is a round **settled**? A round played on a song is settled when
every player has a standing in it. A hand-scored round is settled as soon as
somebody has been given a point, because the points are stated rather than
collected: one to nothing is a result, a player nobody gave points to scored
none, and every point back at zero means nothing has been stated yet. The three
are `getMatchProgress` in the frontend, `buildMatchResultPlayerPoints` in the
commit, and `MatchService.countPendingByPhaseGroup` in the sidebar aggregate.

Two facts move to where they belong:

- The **player** moves from the score to the standing. It was only ever reached
  through the score, which is the reason a standing could not exist without one.
- The **round** gains an identity in the API. It is the unit scoring works on,
  and today it is addressed through its song, which is why a round without a
  song is unaddressable.

## Schema

One migration.

```sql
ALTER TABLE "standing" ADD COLUMN "playerId" integer;
UPDATE "standing" s SET "playerId" = sc."playerId" FROM "score" sc WHERE sc."id" = s."scoreId";
ALTER TABLE "standing" ALTER COLUMN "playerId" SET NOT NULL;
ALTER TABLE "standing" ADD CONSTRAINT "FK_standing_player" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "UQ_standing_round_player" ON "standing" ("roundId", "playerId");
CREATE UNIQUE INDEX "UQ_round_match_song" ON "round" ("matchId", "songId");
CREATE UNIQUE INDEX "UQ_round_match_manual" ON "round" ("matchId") WHERE "songId" IS NULL;
```

`round.songId` and `standing.scoreId` are already nullable in the schema; only
the entity types claimed otherwise.

The two partial rules were never written down before. `UQ_round_match_song`
states that a match cannot hold the same song twice, a rule the random roller
already respected and the explicit add-song route never checked.
`UQ_round_match_manual` states that a match has at most one hand-scored round,
which is how "this match is scored by hand" stops being a flag in a browser and
becomes a fact in the database.

## API

The round becomes a resource.

| Today | After |
| --- | --- |
| `POST /matches/:id/songs` | `POST /matches/:id/rounds` — a song id, a roll, or nothing for a hand-scored round |
| `PUT /matches/:id/songs/:songId` | `PUT /rounds/:roundId` |
| `DELETE /matches/:id/songs/:songId` | `DELETE /rounds/:roundId` |
| `POST` and `PUT /standings/matches/:id` | `PUT /rounds/:roundId/scores/:playerId` |
| — | `PUT /rounds/:roundId/points/:playerId` |
| `DELETE /standings/matches/:id/:playerId/:songId` | `DELETE /rounds/:roundId/standings/:playerId` |

Two write endpoints rather than one, because they carry two kinds of evidence
and each rejects the other: a round with a song refuses `points`, since points
there are computed and the next recalculation would overwrite them; a round
without a song refuses a score, since there is nothing to play. Both write the
same row, and everything that reads it treats them alike.

`PUT` is idempotent on `(roundId, playerId)`, which is now a database constraint
rather than an assumption. SyncStart keeps delivering by song:
`CompletedSongService` resolves the song to its round and calls the same upsert.

There is no compatibility layer. The application is pre-production and
[AGENTS.md](../AGENTS.md) prefers a clean implementation over compatibility with
routes nobody depends on yet.

## What disappears

- `features/match/services/manualScoring.ts` and `hooks/useManualScoring.ts`,
  with the whole `localStorage` draft. Hand-scored points reach the server as
  they are typed, like any other score.
- `CommitMatchResultDto.playerPoints`. The commit no longer accepts points from
  a client; it commits what the database holds.
- The `rounds.length === 0` branch in `MatchWorkflowManager.resolvePlayerPoints`.
- The `manualPoints` parameter threaded through `getMatchProgress`,
  `getMatchCommitState` and `getCommitBlocker`, and through every component that
  passes it along.
- The hand-scored exception in `MatchService.countPendingByPhaseGroup`, which
  would otherwise need a branch of its own: it counts standings, so it counts
  hand-scored rounds without knowing they exist.

The division-standings gap closes as a consequence rather than as a fix.
`DivisionManager.findStandings` sums `standing.points`, and hand-scored matches
now have standings. `songsPlayed` counts rounds that have a song, so a
hand-scored match adds points without claiming songs were played.

## Phases

All six were applied on 2026-08-22. They are kept here as the order to follow if
any of this has to be revisited, and because each one names what it touches.

Each phase leaves the build, the lint and the tests green.

1. **Schema and entities.** The migration above; `Standing.player` required,
   `Standing.score` and `Round.song` nullable in the entity types.

   The API compiles with `strictNullChecks: false`, so those nullable types
   document the model without enforcing it: the compiler will not point at a
   single dereference. The roughly twenty-five sites are found by searching for
   `.song.` and `.score.` and by reading `StandingManager` whole, and the safety
   net is tests rather than types. Turning the flag on for the API is a separate
   piece of work and is not attempted here. The frontend does compile under
   `strict`, so its share of the change is enumerated for us.
2. **Read paths.** Every `standing.score.player` becomes `standing.player`, and
   every `round.song` dereference is guarded. `StandingManager` stops finding
   rounds by song id. Behaviour does not change yet.
3. **Write paths.** The rounds controller, the two standing endpoints, and one
   `StandingService.upsert(roundId, playerId, evidence)` behind them.
   `MatchesController` loses its song routes; `CompletedSongService` calls the
   upsert.
4. **Commit.** `resolvePlayerPoints` collapses to summing standings, and the
   commit DTO loses its points.
5. **Frontend.** `matches.api` follows the new routes; the hand-scored column in
   `MatchTable` writes to the server instead of to `localStorage`; the manual
   scoring store and its hook are deleted along with the `manualPoints`
   parameters.
6. **Cleanup.** FQ-012 in [FunctionalQuestions.md](FunctionalQuestions.md)
   closes: the draft is no longer a per-device thing, so two people at the same
   pool see the same points.

## Decisions taken on 2026-08-22

- **A hand-scored round and song rounds do not coexist.** A hand-scored round
  can only be created on a match with no songs, and adding a song to a
  hand-scored match is refused. This keeps the behaviour the application has
  today and halves the paths to test.
- **Existing hand-scored matches in the local database are left alone.** They
  keep their `MatchResult` and have no rounds, so their result and the bracket
  stay correct while they remain outside the division standings. The gap closes
  for new matches only. No backfill migration is written for data
  [AGENTS.md](../AGENTS.md) already declares disposable.
- **Drafts held in browsers are discarded.** Removing `manualScoring.ts` drops
  any points typed but not committed. They are per-device and pre-production.

## Future handling: mixed rounds

The model allows what the decision above forbids. A match can hold one
hand-scored round alongside its song rounds, and the commit already knows what
to do with it: `resolvePlayerPoints` sums every standing of every round, so
stated points and played points add up on their own. Nothing in the schema
stands in the way either — `UQ_round_match_manual` allows one hand-scored round
per match and says nothing about songs.

Allowing it would give bonuses and penalties for free: a judge awards or
subtracts points on a match that is otherwise played normally, and the result
carries both. It is not needed now, and it is not implemented.

What it would take, when it is: drop the guard that refuses a hand-scored round
on a match with songs, and the symmetric guard on adding a song. Then two
questions have to be answered that the current decision avoids.

The first is presentation. The hand-scored column would sit in the same grid as
the song columns and must read as a different kind of thing without becoming a
second colour system. The dashed outline that already marks an empty slot is the
likeliest answer, because it is a shape signal and survives greyscale.

The second is meaning. `getCommitBlocker` counts what is missing, and a
hand-scored column with nothing typed is indistinguishable from one that is
deliberately zero. Either a stated zero is written as a real standing, which the
model supports, or a match holding a hand-scored round can never be complete by
omission.
