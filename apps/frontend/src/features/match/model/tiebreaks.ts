import type { MatchPlacementTieDto, MatchTiebreakDto } from '@tournament-manager/contracts';
import type { Match } from '@/features/match/model/types';

/**
 * Whether an attempt has everything it is waiting for.
 *
 * `MatchAggregate.isTiebreakComplete` decides the same thing on the server, and
 * the two are the same predicate written twice: they must change together. A
 * played attempt waits for every player, because a missing score is a run
 * nobody entered. A hand-scored one waits for nobody in particular — the values
 * are stated, so the first point settles it and zero everywhere means nothing
 * has been stated yet, exactly as in a hand-scored round.
 */
export function isTiebreakSettled(tiebreak: MatchTiebreakDto): boolean {
    const standings = tiebreak.standings ?? [];
    if (standings.length < 2) {
        return false;
    }

    return tiebreak.song
        ? standings.every((standing) => Boolean(standing.score))
        : standings.some((standing) => (standing.manualPoints ?? 0) > 0);
}

function sameIds(left: number[], right: number[]): boolean {
    if (left.length !== right.length) {
        return false;
    }

    const ids = new Set(right);

    return left.every((id) => ids.has(id));
}

/**
 * The tied groups nobody is addressing yet.
 *
 * A group an attempt already names is not one to offer a tiebreak for: the
 * attempt is on the table and its values can still be changed. What comes back
 * is what is left — including the smaller group an attempt split off without
 * separating, which is a different group and therefore a new question.
 */
export function openTies(match: Match): MatchPlacementTieDto[] {
    const attempts = (match.tiebreaks ?? []).filter((tiebreak) => !tiebreak.invalidated);

    return match.resultState.ambiguousTies.filter(
        (tie) => !attempts.some((attempt) => sameIds(attempt.standings.map((standing) => standing.player.id), tie.playerIds)),
    );
}

/**
 * Whether a tiebreak can be created right now.
 *
 * The second clause is the server's own guard — one unsettled attempt at a
 * time — so the interface offers the action exactly where the API would accept
 * it, rather than offering it and being refused.
 */
export function canCreateTiebreak(match: Match): boolean {
    if (openTies(match).length === 0) {
        return false;
    }

    return !(match.tiebreaks ?? []).some((tiebreak) => !tiebreak.invalidated && !isTiebreakSettled(tiebreak));
}
