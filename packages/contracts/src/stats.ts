import type { AdvancementCompetitionKind, EntrantStatus } from './vocabulary';

/**
 * Where somebody finished a division.
 *
 * `placement` is shared by everybody the tournament never separated, and
 * `sharedThrough` says how far the band reaches: a lone third is `3` and `3`,
 * and four people out of four quarter-finals are `5` and `8`. Two people are
 * separated only by evidence that separates them fairly — a tiebreak they
 * played, or an average over the same songs — which is why entrants who left at
 * the same point of different matches stay together.
 */
export type DivisionPlacementRowDto = {
    entrantId: number;
    entrantName: string;
    playerId: number | null;
    playerName: string | null;
    status: EntrantStatus;
    seedNum: number | null;
    placement: number;
    sharedThrough: number;
    /** What the entrant reached and did not get past. */
    exitKind: AdvancementCompetitionKind;
    exitId: number;
    exitName: string;
    points: number;
    songsPlayed: number;
    /** The mean of the runs they did not fail, across the whole division. */
    averagePercentage: number | null;
};

/**
 * A division's final order, and whether it is one.
 *
 * `complete` is false while any match is still undecided; the rows are computed
 * either way, and a reader that presents them as final has to check it. A
 * division with more than one `endings` has no single winner, because its
 * advancement graph stops in more than one place — the structure allows it and
 * nothing forbids it, so the number is reported rather than assumed to be one.
 */
export type DivisionPlacementsDto = {
    divisionId: number;
    divisionName: string;
    complete: boolean;
    endings: number;
    rows: DivisionPlacementRowDto[];
};

/** How a song was actually played, across one tournament. */
export type SongStatsRowDto = {
    songId: number;
    title: string;
    artist: string | null;
    group: string;
    difficulty: number;
    playedCount: number;
    playerCount: number;
    failedCount: number;
    averagePercentage: number | null;
    bestPercentage: number | null;
    /** The spread of the cleared runs. A song nobody is separated by has none. */
    percentageSpread: number | null;
};

/** What one player did across one tournament. */
export type PlayerStatsRowDto = {
    playerId: number;
    playerName: string;
    points: number;
    songsPlayed: number;
    failedCount: number;
    averagePercentage: number | null;
    bestPercentage: number | null;
    matchesPlayed: number;
    matchesWon: number;
};
