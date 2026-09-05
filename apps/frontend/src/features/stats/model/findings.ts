import type { DivisionPlacementRowDto, DivisionPlacementsDto, PlayerStatsRowDto, SongStatsRowDto } from "@tournament-manager/contracts";

import { seedSwing } from "@/features/stats/model/statsFormat";

/**
 * The four things the numbers turned up, picked rather than counted.
 *
 * FQ-016 removed the counters this could be mistaken for. The test that keeps
 * these apart from those is that each one names somebody: "the best run of the
 * event was 99.42%, on Blue Sunshine" is a thing a person says out loud, and
 * "forty-two players" is a number the page happened to be able to count.
 *
 * Any of them can be absent, and an absent one is not drawn. A tournament where
 * nothing has been played yet has none of them.
 */

/** Below this many runs a spread or a fail rate is noise rather than a finding. */
const ENOUGH_RUNS = 4;

export type BiggestUpset = {
  row: DivisionPlacementRowDto;
  divisionName: string;
  swing: number;
};

export type StatsFindings = {
  bestRun: PlayerStatsRowDto | null;
  mostConsistent: PlayerStatsRowDto | null;
  hardestSong: SongStatsRowDto | null;
  biggestUpset: BiggestUpset | null;
};

export function findingsOf(players: PlayerStatsRowDto[], songs: SongStatsRowDto[], divisions: DivisionPlacementsDto[]): StatsFindings {
  return {
    bestRun: best(players.filter((player) => player.bestPercentage !== null), (player) => player.bestPercentage ?? 0),
    mostConsistent: best(
      players.filter((player) => player.percentageSpread !== null && clearedRuns(player) >= ENOUGH_RUNS),
      (player) => -(player.percentageSpread ?? 0),
    ),
    hardestSong: best(
      songs.filter((song) => song.playedCount >= ENOUGH_RUNS && song.failedCount > 0),
      (song) => song.failedCount / song.playedCount,
    ),
    biggestUpset: biggestUpset(divisions),
  };
}

function clearedRuns(player: PlayerStatsRowDto): number {
  return player.songsPlayed - player.failedCount;
}

function best<T>(candidates: T[], score: (candidate: T) => number): T | null {
  return candidates.reduce<T | null>((held, candidate) => (held === null || score(candidate) > score(held) ? candidate : held), null);
}

/**
 * Whoever finished furthest above their seed, across every finished division.
 *
 * A division still being played has no final order, so it has no upset either.
 * The swing is measured from where a band starts, which is the best the
 * tournament is willing to say about anybody inside it.
 */
function biggestUpset(divisions: DivisionPlacementsDto[]): BiggestUpset | null {
  const candidates = divisions
    .filter((division) => division.complete)
    .flatMap((division) =>
      division.rows.map((row) => ({ row, divisionName: division.divisionName, swing: seedSwing(row) ?? 0 })),
    )
    .filter((candidate) => candidate.swing > 0);

  return best(candidates, (candidate) => candidate.swing);
}
