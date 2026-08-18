import {
  ILobbyObserver,
  LobbyConnectionDto,
  LobbyMatchUpdateDto,
  LobbyPlayerReadyDto,
  LobbySongCompletedDto,
  LobbySongSelectedDto,
  SyncStartConnectionStatusDto,
} from './lobby-observer.interface';

export class LobbyEventDispatcher {
  constructor(private readonly observers: ILobbyObserver[]) {}

  async OnSyncStartConnectionStatus(event: SyncStartConnectionStatusDto): Promise<void> {
    await Promise.all(this.observers.map((observer) => observer.OnSyncStartConnectionStatus?.(event)));
  }

  async OnConnectionActive(event: LobbyConnectionDto): Promise<void> {
    await Promise.all(this.observers.map((observer) => observer.OnConnectionActive?.(event)));
  }

  async OnConnected(event: LobbyConnectionDto): Promise<void> {
    await Promise.all(this.observers.map((observer) => observer.OnConnected?.(event)));
  }

  async OnDisconnection(event: LobbyConnectionDto): Promise<void> {
    await Promise.all(this.observers.map((observer) => observer.OnDisconnection?.(event)));
  }

  async OnSongSelected(event: LobbySongSelectedDto): Promise<void> {
    await Promise.all(this.observers.map((observer) => observer.OnSongSelected?.(event)));
  }

  async OnGoingMatchUpdate(event: LobbyMatchUpdateDto): Promise<void> {
    await Promise.all(this.observers.map((observer) => observer.OnGoingMatchUpdate?.(event)));
  }

  async OnSongCompleted(event: LobbySongCompletedDto): Promise<void> {
    await Promise.all(this.observers.map((observer) => observer.OnSongCompleted?.(event)));
  }

  async OnPlayerReady(event: LobbyPlayerReadyDto): Promise<void> {
    await Promise.all(this.observers.map((observer) => observer.OnPlayerReady?.(event)));
  }
}
