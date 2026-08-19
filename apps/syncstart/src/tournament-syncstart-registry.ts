import { Injectable, OnApplicationShutdown } from "@nestjs/common";
import {
  defaultSyncStartClientFactory,
  SyncStartClient,
  type SyncStartClientFactory,
} from "@tournament-manager/syncstart-protocol";
import { LobbyCatalog, LobbySummary } from "./lobby-catalog";
import { CompletedSongSubmitter } from "./completed-song-submitter";
import { SyncStartEventsPublisher } from "./syncstart-events.publisher";

type ConnectionStatus = { isActive: boolean; isConnected: boolean };

@Injectable()
export class TournamentSyncStartRegistry implements OnApplicationShutdown {
  private readonly clients = new Map<number, SyncStartClient>();

  constructor(
    private readonly catalog: LobbyCatalog,
    private readonly events: SyncStartEventsPublisher,
    private readonly completedSongs: CompletedSongSubmitter,
    private readonly clientFactory: SyncStartClientFactory = defaultSyncStartClientFactory,
  ) {}

  configure(tournamentId: number, syncstartUrl: string): void {
    this.close(tournamentId);
    if (syncstartUrl) {
      this.clients.set(
        tournamentId,
        this.clientFactory(syncstartUrl, [
          this.catalog,
          this.events,
          this.completedSongs,
        ]),
      );
    }
  }

  close(tournamentId: number): void {
    this.clients.get(tournamentId)?.DisconnectAll();
    this.clients.delete(tournamentId);
    this.catalog.removeTournament(tournamentId);
  }

  connectServer(tournamentId: number): Promise<ConnectionStatus> {
    return this.client(tournamentId).ConnectToServer(tournamentId);
  }

  disconnectServer(tournamentId: number): ConnectionStatus {
    return this.client(tournamentId).DisconnectFromServer();
  }

  async listLobbies(tournamentId: number): Promise<{
    status: ConnectionStatus;
    lobbies: LobbySummary[];
  }> {
    const client = this.clients.get(tournamentId);
    const status = {
      isActive: client?.IsActive() ?? false,
      isConnected: client?.IsConnected() ?? false,
    };
    const discovered =
      client && status.isConnected ? await client.SearchLobbies() : [];
    return { status, lobbies: this.catalog.list(tournamentId, discovered) };
  }

  async connectLobby(request: {
    tournamentId: number;
    lobbyName: string;
    lobbyCode: string;
    password?: string;
  }): Promise<{ id: string }> {
    const lobbyCode = request.lobbyCode.toUpperCase();
    const result = await this.client(request.tournamentId).SpectateLobby({
      ...request,
      lobbyCode,
      lobbyName: request.lobbyName || lobbyCode,
      password: request.password ?? "",
    });
    return { id: result.lobbyId };
  }

  createLobby(request: {
    tournamentId: number;
    lobbyName: string;
    password?: string;
  }): Promise<{ lobbyId: string; lobbyCode: string }> {
    return this.client(request.tournamentId).CreateLobby({
      ...request,
      lobbyName: request.lobbyName || undefined,
      password: request.password ?? "",
    });
  }

  disconnectLobby(tournamentId: number, lobbyId: string): void {
    this.client(tournamentId).LeaveLobby(lobbyId);
  }

  onApplicationShutdown(): void {
    for (const client of this.clients.values()) client.DisconnectAll();
  }

  private client(tournamentId: number): SyncStartClient {
    const client = this.clients.get(tournamentId);
    if (!client) {
      throw new Error(
        `No SyncStart client for tournament=${tournamentId}. Ensure the tournament has a syncstartUrl set.`,
      );
    }
    return client;
  }
}
