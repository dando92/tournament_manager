import type { MatchDto } from "./match";

export type ControlRoomFlowStatus = "inactive" | "running" | "paused" | "completed";

export type ControlRoomStaleCode =
    | "NO_ENTRANTS"
    | "NOT_ENOUGH_ENTRANTS"
    | "UNRESOLVED_ENTRANTS"
    | "NO_ROUNDS"
    | "MATCH_ALREADY_ACTIVE"
    | "ENTRANTS_ALREADY_ACTIVE"
    | "MATCH_REMOVED"
    | "MATCH_OUTSIDE_TOURNAMENT"
    | "CURRENT_MATCH_CHANGED_EXTERNALLY";

export type ControlRoomStaleDetails = {
    matchId?: number;
    matchName?: string;
    entrantCount?: number;
    requiredEntrantCount?: number;
    blockingMatchIds?: number[];
    blockingPlayerIds?: number[];
};

export type ControlRoomFlowEntryDto = {
    id: number;
    position: number;
    match: MatchDto;
};

export type ControlRoomFlowDto = {
    id: number;
    name: string;
    status: ControlRoomFlowStatus;
    currentEntryId: number | null;
    staleCode: ControlRoomStaleCode | null;
    staleDetails: ControlRoomStaleDetails | null;
    archivedAt: string | null;
    version: number;
    entries: ControlRoomFlowEntryDto[];
};

export type ControlRoomEditorDto = {
    flow: ControlRoomFlowDto;
    unassignedMatches: MatchDto[];
};

export type ControlRoomFlowAddressDto = {
    tournamentId: number;
    flowId: number;
};
