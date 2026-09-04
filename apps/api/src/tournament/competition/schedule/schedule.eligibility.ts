import type { ScheduleStaleCode, ScheduleStaleDetails } from "@tournament-manager/contracts";

export type ScheduleMatchSnapshot = {
    matchId: number;
    matchName: string;
    active: boolean;
    completed: boolean;
    readyToCommit: boolean;
    playerIds: number[];
    roundCount: number;
    requiredEntrantCount: number;
    isCurrentEntry: boolean;
};

/** Which other active matches hold a player of this one, and which players. */
export type ScheduleConflicts = {
    blockingMatchIds: number[];
    blockingPlayerIds: number[];
};

export type ScheduleEligibility =
    { kind: "passed" } | { kind: "eligible" } | { kind: "stale"; code: ScheduleStaleCode; details: ScheduleStaleDetails };

/**
 * Everything the schedule can decide about an entry from that entry alone.
 *
 * The chain is ordered, and the order is the point: the checks here read the
 * entry's own snapshot, while the one left out — whether somebody else is
 * already playing these people — is a question about the whole tournament.
 * Asking it per entry answered it for every match the chain above was going to
 * reject anyway.
 */
export function evaluateLocalEligibility(match: ScheduleMatchSnapshot): ScheduleEligibility {
    if (match.completed || match.readyToCommit) {
        return { kind: "passed" };
    }

    const details = detailsOf(match);

    if (match.playerIds.length === 0) {
        return { kind: "stale", code: "NO_ENTRANTS", details };
    }
    if (match.playerIds.length === 1) {
        return { kind: "stale", code: "NOT_ENOUGH_ENTRANTS", details };
    }
    if (match.playerIds.length < match.requiredEntrantCount) {
        return { kind: "stale", code: "UNRESOLVED_ENTRANTS", details };
    }
    if (match.roundCount === 0) {
        return { kind: "stale", code: "NO_ROUNDS", details };
    }
    if (match.active && !match.isCurrentEntry) {
        return { kind: "stale", code: "MATCH_ALREADY_ACTIVE", details };
    }

    return { kind: "eligible" };
}

/**
 * The last check, which only the candidate needs.
 *
 * A player cannot be sent to two cabinets at once, so an entry waits while
 * another match has them. Exactly one entry per recalculation reaches this,
 * which is why the conflicts behind it are resolved once rather than per entry.
 */
export function evaluateConflicts(match: ScheduleMatchSnapshot, conflicts: ScheduleConflicts): ScheduleEligibility {
    if (conflicts.blockingMatchIds.length === 0) {
        return { kind: "eligible" };
    }

    return {
        kind: "stale",
        code: "ENTRANTS_ALREADY_ACTIVE",
        details: {
            ...detailsOf(match),
            blockingMatchIds: conflicts.blockingMatchIds,
            blockingPlayerIds: conflicts.blockingPlayerIds,
        },
    };
}

/** What every stale reason states about the match it names. */
function detailsOf(match: ScheduleMatchSnapshot): ScheduleStaleDetails {
    return {
        matchId: match.matchId,
        matchName: match.matchName,
        entrantCount: match.playerIds.length,
        requiredEntrantCount: match.requiredEntrantCount,
    };
}
