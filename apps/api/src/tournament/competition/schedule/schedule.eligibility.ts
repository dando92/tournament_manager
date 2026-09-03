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
    blockingMatchIds: number[];
    blockingPlayerIds: number[];
    isCurrentEntry: boolean;
};

export type ScheduleEligibility =
    { kind: "passed" } | { kind: "eligible" } | { kind: "stale"; code: ScheduleStaleCode; details: ScheduleStaleDetails };

export function evaluateScheduleMatch(match: ScheduleMatchSnapshot): ScheduleEligibility {
    if (match.completed || match.readyToCommit) {
        return { kind: "passed" };
    }

    const details: ScheduleStaleDetails = {
        matchId: match.matchId,
        matchName: match.matchName,
        entrantCount: match.playerIds.length,
        requiredEntrantCount: match.requiredEntrantCount,
    };

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
    if (match.blockingMatchIds.length > 0) {
        return {
            kind: "stale",
            code: "ENTRANTS_ALREADY_ACTIVE",
            details: {
                ...details,
                blockingMatchIds: match.blockingMatchIds,
                blockingPlayerIds: match.blockingPlayerIds,
            },
        };
    }

    return { kind: "eligible" };
}
