export type ActiveLobbyDto = {
  tournamentId: number;
  lobbyId: string;
  lobbyName: string;
  lobbyCode: string;
  isActive: boolean;
  isConnected: boolean;
};

export type SyncStartConnectionStatusDto = {
  tournamentId: number;
  isActive: boolean;
  isConnected: boolean;
};

export type LobbySongSelectedDto = {
  tournamentId: number;
  lobbyId: string;
  lobbyName: string;
  lobbyCode: string;
  songTitle: string;
  songPath: string;
};

export type LobbyPlayerReadyDto = {
  tournamentId: number;
  lobbyId: string;
  lobbyName: string;
  lobbyCode: string;
  playerId: string;
  playerName: string;
  ready: boolean;
};

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
