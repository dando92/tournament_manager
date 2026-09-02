import type { Match } from '@/features/match/model/types';

/**
 * The points one player holds in a match right now.
 *
 * A committed match answers with the points the commit froze. Everything
 * before that is a running total, because the rounds already played are a
 * result even when the ones after them are not. `resultState` is not the place
 * to read it from: the server leaves its entries empty until the whole match
 * resolves, so a table that reads them shows nothing but zeroes for as long as
 * the match is being played.
 *
 * The total only ever moves a round at a time. A round scored from a song
 * awards no points until every player in it has a score, so a half-filled
 * round contributes zero rather than a provisional figure nobody should read.
 */
export function matchPointsOf(match: Match, playerId: number): number {
    const committed = match.matchResult?.playerPoints?.find((entry) => entry.playerId === playerId)?.points;
    if (committed !== undefined) {
        return committed;
    }

    return (match.rounds ?? []).reduce((total, round) => {
        const standing = (round.standings ?? []).find((candidate) => candidate.player.id === playerId);

        return total + (standing?.points ?? 0);
    }, 0);
}

/**
 * How both tables order the players of a match.
 *
 * The resolved order wins when there is one: `resultState` lists its entries in
 * placement order, and that is the answer the server settled on. While the
 * match is still open there are no entries to read, and the running points are
 * the closest thing to a standing there is, so they order the rows instead.
 */
export function byMatchStanding<T extends { id: number }>(match: Match): (left: T, right: T) => number {
    const resolvedOrder = new Map(match.resultState.entries.map((entry, index) => [entry.playerId, index]));
    const placeOf = (playerId: number) => resolvedOrder.get(playerId) ?? Number.MAX_SAFE_INTEGER;

    return (left, right) =>
        placeOf(left.id) - placeOf(right.id) || matchPointsOf(match, right.id) - matchPointsOf(match, left.id) || left.id - right.id;
}
