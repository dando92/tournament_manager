import type { ControlRoomFlowDto, ControlRoomStaleCode } from "@tournament-manager/contracts";

export function controlRoomStatusLabel(flow: ControlRoomFlowDto): string {
    if (flow.status === "running" && flow.staleCode) return "Running — Waiting";
    return flow.status.charAt(0).toUpperCase() + flow.status.slice(1);
}

const staleMessages: Record<ControlRoomStaleCode, (flow: ControlRoomFlowDto) => string> = {
    NO_ENTRANTS: (flow) => `${flow.staleDetails?.matchName ?? "The current match"} has no players.`,
    NOT_ENOUGH_ENTRANTS: (flow) => `${flow.staleDetails?.matchName ?? "The current match"} has only one player.`,
    UNRESOLVED_ENTRANTS: (flow) => `${flow.staleDetails?.matchName ?? "The current match"} is waiting for more entrants.`,
    NO_ROUNDS: (flow) => `${flow.staleDetails?.matchName ?? "The current match"} has no rounds configured.`,
    MATCH_ALREADY_ACTIVE: (flow) => `${flow.staleDetails?.matchName ?? "The current match"} was activated outside this flow.`,
    ENTRANTS_ALREADY_ACTIVE: () => "One or more players are still active in another match.",
    MATCH_REMOVED: () => "The current match no longer exists.",
    MATCH_OUTSIDE_TOURNAMENT: () => "The current match no longer belongs to this tournament.",
    CURRENT_MATCH_CHANGED_EXTERNALLY: () => "The current match changed outside the control room.",
};

export function controlRoomStaleMessage(flow: ControlRoomFlowDto): string | null {
    return flow.staleCode ? staleMessages[flow.staleCode](flow) : null;
}
