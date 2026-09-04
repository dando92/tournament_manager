import type { MatchDto, MatchSummaryDto, PlayerRefDto } from "@tournament-manager/contracts";

import { entrantPlayers } from "@/features/participant/model/entrant";
import { getCommitBlocker, getMatchProgress, type MatchProgress } from "@/features/match/model/matchStatus";

/**
 * What one row of a list of matches draws.
 *
 * The row is the same wherever it appears — the Control Room queue, the
 * division's match list — but the level the caller read the match at is not.
 * A list that reads the Summary branches on the `state` column; one that still
 * reads the Detail derives the same facts from the rounds it holds. Both end
 * here, so the row component itself knows about neither.
 *
 * Nothing in it is a sentence except `blocker`, which is one because it is the
 * precondition of a button and belongs beside it.
 */
export type MatchRowModel = {
    id: number;
    name: string;
    subtitle: string;
    active: boolean;
    progress: MatchProgress;
    blocker: string | null;
    playerCount: number;
    songCount: number;
    handScored: boolean;
};

/** The players a summary holds: a team entrant stands for none. */
export function summaryPlayers(match: MatchSummaryDto): PlayerRefDto[] {
    return (match.entrants ?? [])
        .map((entrant) => entrant.player)
        .filter((player): player is PlayerRefDto => Boolean(player));
}

/**
 * A row from the Summary level.
 *
 * `state` is the column `MatchAggregate` writes, so the progress a list shows
 * and the progress the server decided cannot come apart. The one thing the
 * column does not say is whether a tiebreak has already been opened — that is
 * a fact about the attempts rather than about the result — so the summary
 * carries it beside the state.
 */
export function rowOfSummary(match: MatchSummaryDto): MatchRowModel {
    const playerCount = summaryPlayers(match).length;
    const progress = progressOfState(match);

    return {
        id: match.id,
        name: match.name,
        subtitle: match.subtitle,
        active: match.active,
        progress,
        blocker: blockerOf(progress, playerCount, match.songCount, match.handScored, match.missingScoreCount),
        playerCount,
        songCount: match.songCount,
        handScored: match.handScored,
    };
}

/**
 * A row from the Detail level, for the list that still reads every match in
 * full. It goes with item 64 of `PerformanceReadiness.md`.
 */
export function rowOfMatch(match: MatchDto): MatchRowModel {
    const players = entrantPlayers(match.entrants);

    return {
        id: match.id,
        name: match.name,
        subtitle: match.subtitle,
        active: match.active,
        progress: getMatchProgress(match),
        blocker: getCommitBlocker(match),
        playerCount: players.length,
        /* Counting rounds would call the hand-scored one a song, which is the
           one thing it is not. */
        songCount: match.rounds.filter((round) => round.song !== null).length,
        handScored: match.rounds.some((round) => round.song === null),
    };
}

function progressOfState(match: MatchSummaryDto): MatchProgress {
    if (match.state === "completed") {
        return "completed";
    }
    if (match.state === "ready") {
        return "readyToCommit";
    }
    if (match.state === "tiebreak_required") {
        return match.tiebreakInProgress ? "tiebreakInProgress" : "tiebreakRequired";
    }

    return match.state === "partial" ? "started" : "empty";
}

/**
 * Why the commit button cannot fire yet, from counts rather than from rounds.
 *
 * The same answers `getCommitBlocker` gives, in the same order, so a row does
 * not change what it says when its list changes level.
 */
function blockerOf(progress: MatchProgress, playerCount: number, songCount: number, handScored: boolean, missingScoreCount: number): string | null {
    if (progress !== "empty" && progress !== "started") {
        return null;
    }
    if (playerCount === 0) {
        return "No players yet";
    }
    if (songCount === 0 && !handScored) {
        return "No songs yet";
    }
    /* Counting the players still without points would promise that every one of
       them needs some, and a hand-scored match does not: one point is a result. */
    if (handScored) {
        return "No points assigned";
    }

    return `${missingScoreCount} score${missingScoreCount !== 1 ? "s" : ""} missing`;
}
