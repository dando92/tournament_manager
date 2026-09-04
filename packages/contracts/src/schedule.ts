import type { MatchSummaryDto } from "./match";

export type ScheduleStatus = "inactive" | "running" | "completed";

export type ScheduleInterruptionCode = "MATCH_RESULT_REOPENED" | "ROLLBACK_CONFIRMED" | "TOURNAMENT_CLOSED";

export type ScheduleStaleCode =
    | "NO_ENTRANTS"
    | "NOT_ENOUGH_ENTRANTS"
    | "UNRESOLVED_ENTRANTS"
    | "UNFILLABLE_ENTRANT_SLOTS"
    | "NO_ROUNDS"
    | "MATCH_ALREADY_ACTIVE"
    | "ENTRANTS_ALREADY_ACTIVE"
    | "MATCH_REMOVED"
    | "MATCH_OUTSIDE_TOURNAMENT"
    | "CURRENT_MATCH_CHANGED_EXTERNALLY";

export type ScheduleStaleDetails = {
    matchId?: number;
    matchName?: string;
    entrantCount?: number;
    requiredEntrantCount?: number;
    /**
     * The most entrants the match can still reach: the ones it holds plus the
     * advancement rules that have not delivered yet. Below `requiredEntrantCount`
     * it says the wait cannot end on its own, which is what separates
     * `UNFILLABLE_ENTRANT_SLOTS` from `UNRESOLVED_ENTRANTS`.
     */
    reachableEntrantCount?: number;
    blockingMatchIds?: number[];
    blockingPlayerIds?: number[];
};

/**
 * One row of a timetable.
 *
 * It carries the match at its Summary level, because a board draws a schedule
 * and not a match: the rounds, standings, scores and tiebreaks a card shows are
 * read by `GET /matches/:id` when somebody opens one.
 */
export type ScheduleEntryDto = {
    id: number;
    position: number;
    expectedDurationMinutes: number;
    startedAt: string | null;
    completedAt: string | null;
    match: MatchSummaryDto;
};

export type ScheduleDto = {
    id: number;
    name: string;
    willStartAt: string;
    status: ScheduleStatus;
    currentEntryId: number | null;
    staleCode: ScheduleStaleCode | null;
    staleDetails: ScheduleStaleDetails | null;
    interruptionCode: ScheduleInterruptionCode | null;
    interruptionDetails: Record<string, unknown> | null;
    interruptedAt: string | null;
    archivedAt: string | null;
    version: number;
    entries: ScheduleEntryDto[];
};

export type ScheduleCreationDto = {
    unassignedMatches: MatchSummaryDto[];
};

export type ScheduleEntryInputDto = {
    matchId: number;
    expectedDurationMinutes: number;
};

export type ScheduleEditorDto = {
    schedule: ScheduleDto;
    unassignedMatches: MatchSummaryDto[];
};

export type ScheduleAddressDto = {
    tournamentId: number;
    scheduleId: number;
};

/**
 * What the schedules of a tournament amount to, without reading any of them.
 *
 * Two counts, and both exist so that nothing has to load a board to learn a
 * scalar. `running` is the fact a match card outside the schedule pages needs:
 * while a schedule is running it owns which of its matches is active, so manual
 * activation is refused, and answering that used to mount every board of the
 * tournament. `archivedCount` is what lets a page offer the archived boards
 * without having fetched them.
 */
export type ScheduleActivityDto = {
    running: boolean;
    archivedCount: number;
};
