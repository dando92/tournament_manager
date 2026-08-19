export interface EventEnvelope<TPayload = unknown> {
  id: string;
  type: string;
  aggregateId: string;
  payload: TPayload;
}

export interface TournamentCreatedPayload {
  tournamentId: number;
  name: string;
}

export type TournamentCreatedEvent = EventEnvelope<TournamentCreatedPayload> & {
  type: "tournament.created";
};

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

export type SyncStartSongCompletedEvent =
  EventEnvelope<SyncStartSongCompletedPayload> & {
    type: "syncstart.song-completed";
  };

export type SyncStartCommandAction =
  | "configure-tournament"
  | "close-tournament"
  | "connect-server"
  | "disconnect-server"
  | "list-lobbies"
  | "connect-lobby"
  | "create-lobby"
  | "disconnect-lobby";

export interface SyncStartCommandPayload {
  action: SyncStartCommandAction;
  tournamentId: number;
  syncstartUrl?: string;
  lobbyId?: string;
  lobbyCode?: string;
  lobbyName?: string;
  password?: string;
}

export type SyncStartCommandEvent = EventEnvelope<SyncStartCommandPayload> & {
  type: "syncstart.command";
};

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

export interface LiveEventEnvelope<TPayload = unknown> {
  type: string;
  tournamentId: number;
  payload: TPayload;
  sequence?: number;
}

export function isEventEnvelope(value: unknown): value is EventEnvelope {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.id === "string" &&
    typeof event.type === "string" &&
    typeof event.aggregateId === "string" &&
    Object.prototype.hasOwnProperty.call(event, "payload")
  );
}
