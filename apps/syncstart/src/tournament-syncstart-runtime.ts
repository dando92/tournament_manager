import type { ILobbyObserver, SyncStartClientFactory } from "@tournament-manager/syncstart-protocol";
import { LobbyCatalog, type LobbySummary } from "./lobby-catalog";

type ConnectionStatus = { isActive: boolean; isConnected: boolean };

/** Owns one configured tournament's SyncStart client and local projection. */
export class TournamentSyncStartRuntime {
  private readonly catalog: LobbyCatalog;
  private readonly client;

  constructor(
    readonly tournamentId: number,
    syncstartUrl: string,
    observers: ILobbyObserver[],
    clientFactory: SyncStartClientFactory,
  ) {
    this.catalog = new LobbyCatalog(tournamentId);
    this.client = clientFactory(tournamentId, syncstartUrl, [
      this.catalog,
      ...observers,
    ]);
  }

  connectServer(): Promise<ConnectionStatus> {
    return this.client.ConnectToServer();
  }

  disconnectServer(): ConnectionStatus {
    return this.client.DisconnectFromServer();
  }

  async listLobbies(): Promise<{
    status: ConnectionStatus;
    lobbies: LobbySummary[];
  }> {
    const status = {
      isActive: this.client.IsActive(),
      isConnected: this.client.IsConnected(),
    };
    const discovered = status.isConnected
      ? await this.client.SearchLobbies()
      : [];
    return { status, lobbies: this.catalog.list(discovered) };
  }

  async connectLobby(request: {
    lobbyName: string;
    lobbyCode: string;
    password?: string;
  }): Promise<{ id: string }> {
    const lobbyCode = request.lobbyCode.toUpperCase();
    const result = await this.client.SpectateLobby({
      ...request,
      lobbyCode,
      lobbyName: request.lobbyName || lobbyCode,
      password: request.password ?? "",
    });
    return { id: result.lobbyId };
  }

  createLobby(request: {
    lobbyName: string;
    password?: string;
  }): Promise<{ lobbyId: string; lobbyCode: string }> {
    return this.client.CreateLobby({
      ...request,
      lobbyName: request.lobbyName || undefined,
      password: request.password ?? "",
    });
  }

  disconnectLobby(lobbyId: string): void {
    this.client.LeaveLobby(lobbyId);
  }

  close(): void {
    this.client.DisconnectAll();
    this.catalog.clear();
  }
}
