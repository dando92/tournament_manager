export interface SyncStartSongCompletedPayload {
  tournamentId: number;
  lobbyId: string;
  lobbyName: string;
  lobbyCode: string;
  song: {
    songPath: string;
    title: string;
    artist: string;
    songLength: number;
  };
  scores: Array<{
    playerId: string;
    playerName: string;
    score: number;
    exScore?: number;
    isFailed: boolean;
  }>;
}

export interface ConfigureSyncStartTournamentRequest {
  tournamentId: number;
  syncstartUrl: string;
}

export interface ConnectSyncStartLobbyRequest {
  tournamentId: number;
  lobbyName: string;
  lobbyCode: string;
  password: string;
}

export interface CreateSyncStartLobbyRequest {
  tournamentId: number;
  lobbyName: string;
  password: string;
}

export interface SyncStartServerStatusDto {
  isActive: boolean;
  isConnected: boolean;
}

export interface SyncStartLobbyStatusDto {
  id: string;
  name: string;
  lobbyCode: string;
  isPasswordProtected: boolean;
  playerCount: number;
  spectatorCount: number;
}

export interface SyncStartLobbiesDto {
  status: SyncStartServerStatusDto;
  lobbies: SyncStartLobbyStatusDto[];
}

export interface ConnectedSyncStartLobbyDto {
  id: string;
}

export interface CreatedSyncStartLobbyDto {
  lobbyId: string;
  lobbyCode: string;
}

export interface SyncStartCommandResultPayload {
  commandId: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export type LobbyIdentityDto = {
  tournamentId: number;
  lobbyId: string;
  lobbyName: string;
  lobbyCode: string;
};

export type LobbyConnectionDto = LobbyIdentityDto & {
  isActive: boolean;
  isConnected: boolean;
};

export type SyncStartConnectionStatusDto = {
  tournamentId: number;
  isActive: boolean;
  isConnected: boolean;
};

export type LobbySongDto = {
  songPath: string;
  title: string;
  artist: string;
  songLength: number;
};

export type LobbySongSelectedDto = LobbyIdentityDto & { song: LobbySongDto };
export type LobbyPlayerReadyDto = LobbyIdentityDto & {
  playerId: string;
  playerName: string;
  ready: boolean;
};
export type LobbyJudgmentsDto = {
  fantasticPlus: number;
  fantastics: number;
  excellents: number;
  greats: number;
  decents: number;
  wayOffs: number;
  misses: number;
  minesHit: number;
  holdsHeld: number;
  totalHolds: number;
};
export type LobbyLivePlayerDto = {
  playerId: string;
  playerName: string;
  score: number;
  exScore?: number;
  isFailed: boolean;
  songProgression?: { currentTime: number; totalTime: number };
  judgments?: LobbyJudgmentsDto;
};
export type LobbyMatchUpdateDto = LobbyIdentityDto & {
  song?: LobbySongDto;
  players: LobbyLivePlayerDto[];
};
export type LobbyCompletedScoreDto = {
  playerId: string;
  playerName: string;
  score: number;
  exScore?: number;
  isFailed: boolean;
};
export type LobbySongCompletedDto = LobbyIdentityDto & {
  song: LobbySongDto;
  scores: LobbyCompletedScoreDto[];
};

export type SyncStartTelemetryType =
  | "syncstart.connection-status"
  | "syncstart.lobby-active"
  | "syncstart.lobby-connected"
  | "syncstart.lobby-disconnected"
  | "syncstart.song-selected"
  | "syncstart.match-update"
  | "syncstart.song-completed-live"
  | "syncstart.player-ready"
  | "syncstart.command-result";

export interface CompletedSongRequest {
  completionId: string;
  tournamentId: number;
  lobbyId: string;
  lobbyName: string;
  lobbyCode: string;
  song: LobbySongDto;
  scores: LobbyCompletedScoreDto[];
}
