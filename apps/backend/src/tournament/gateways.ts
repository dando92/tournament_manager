import { LiveMatchGateway } from "../tournament/gateways/live-match.gateway";
import { LobbyGateway } from "../tournament/gateways/lobby.gateway";
import { UiUpdateGateway } from "@match/gateways/ui-update.gateway";

export { LiveMatchGateway };
export { LobbyGateway };
export { UiUpdateGateway };

export const Gateways = [
    LobbyGateway,
    LiveMatchGateway,
    UiUpdateGateway
];
