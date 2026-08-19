export type CreateLobbyRequestDto = {
  lobbyName?: string;
  password?: string;
};

export type SpectateLobbyRequestDto = CreateLobbyRequestDto & {
  lobbyCode: string;
};

export type LobbyConnectionResultDto = {
  lobbyId: string;
  lobbyCode: string;
};

export type SyncStartLobbySummaryDto = {
  code: string;
  isPasswordProtected: boolean;
  playerCount: number;
  spectatorCount: number;
};
