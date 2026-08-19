import type {
  LobbyCompletedScoreDto,
  LobbyConnectionDto,
  LobbyIdentityDto,
  LobbyJudgmentsDto,
  LobbyLivePlayerDto,
  LobbyMatchUpdateDto,
  LobbyPlayerReadyDto,
  LobbySongCompletedDto,
  LobbySongDto,
  LobbySongSelectedDto,
  SyncStartConnectionStatusDto,
} from "@tournament-manager/contracts";

export type {
  LobbyCompletedScoreDto,
  LobbyConnectionDto,
  LobbyIdentityDto,
  LobbyJudgmentsDto,
  LobbyLivePlayerDto,
  LobbyMatchUpdateDto,
  LobbyPlayerReadyDto,
  LobbySongCompletedDto,
  LobbySongDto,
  LobbySongSelectedDto,
  SyncStartConnectionStatusDto,
};

export interface ILobbyObserver {
  OnSyncStartConnectionStatus?(
    event: SyncStartConnectionStatusDto,
  ): void | Promise<void>;
  OnConnectionActive?(event: LobbyConnectionDto): void | Promise<void>;
  OnConnected?(event: LobbyConnectionDto): void | Promise<void>;
  OnDisconnection?(event: LobbyConnectionDto): void | Promise<void>;
  OnSongSelected?(event: LobbySongSelectedDto): void | Promise<void>;
  OnGoingMatchUpdate?(event: LobbyMatchUpdateDto): void | Promise<void>;
  OnSongCompleted?(event: LobbySongCompletedDto): void | Promise<void>;
  OnPlayerReady?(event: LobbyPlayerReadyDto): void | Promise<void>;
}
