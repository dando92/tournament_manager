# Match Tiebreaks

## Decision

A tiebreak is match-owned evidence that resolves placement ambiguity without
changing normal match points. It is not a round and is never included in the
sum of standings, division statistics, or songs played.

Result construction has three explicit phases:

1. `calculatePoints` sums only normal match rounds.
2. `resolvePlacements` partitions equal totals and applies completed tiebreaks
   in sequence.
3. `buildMatchResult` freezes both points and placements for advancement and
   rollback.

An unresolved tie blocks commit only when its occupied source placements have
different advancement outcomes. The outcome includes target kind, target id,
and target slot. Ties outside advancement rules remain shared placements.

## Tiebreak attempts

A match may hold several attempts. Each attempt names exactly one currently
unresolved tied group. A song attempt ranks completed scores by failure state
and percentage; a manual attempt ranks stated integer values. Equal attempt
values leave a smaller unresolved group which another attempt may address.

Changing ordinary scores, rounds, entrants, or the scoring system invalidates
existing attempts. Invalidated attempts remain as audit evidence but do not
participate in placement resolution.

## Interface

Desktop keeps the player-by-round table and presents tiebreak evidence after
the points column. Mobile does not assign another meaning to horizontal swipe:
for fields of at most four players it transposes the table, with players as
columns and rounds, points, tiebreaks, and placement as rows. Larger fields use
a compact player, points, and placement table with vertically expandable score
details.
