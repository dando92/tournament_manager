import { LobbyConnectionDto, SyncStartConnectionStatusDto } from '@syncstart/index';

export type ActiveLobbyDto = LobbyConnectionDto;
export type SyncStartStatusDto = SyncStartConnectionStatusDto;

export type LobbyCardPlayerDto = {
  playerId: string;
  playerName: string;
  ready: boolean;
};

export type LobbyCardStateDto = {
  tournamentId: number;
  lobbyId: string;
  lobbyName: string;
  lobbyCode: string;
  songTitle: string;
  songPath: string;
  players: LobbyCardPlayerDto[];
};

export type LiveMatchPlayerDto = {
  playerId: string;
  playerName: string;
  score: number;
  exScore?: number;
  isFailed: boolean;
  isCompleted?: boolean;
  songProgression?: {
    currentTime: number;
    totalTime: number;
  };
  judgments?: {
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
};

export type LiveMatchStateDto = {
  tournamentId: number;
  lobbyId: string;
  lobbyName: string;
  lobbyCode: string;
  songTitle: string;
  songPath: string;
  players: LiveMatchPlayerDto[];
};
