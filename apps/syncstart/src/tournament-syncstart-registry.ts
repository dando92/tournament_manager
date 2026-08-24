import { Inject, Injectable, OnApplicationShutdown } from "@nestjs/common";
import type { SyncStartClientFactory } from "@tournament-manager/syncstart-protocol";
import { CompletedSongSubmitter } from "./completed-song-submitter";
import { SYNCSTART_CLIENT_FACTORY } from "./syncstart-client.factory";
import { SyncStartEventsPublisher } from "./syncstart-events.publisher";
import { TournamentSyncStartRuntime } from "./tournament-syncstart-runtime";

type ConnectionStatus = { isActive: boolean; isConnected: boolean };

/** Creates, locates, replaces, and shuts down replica-local tournament owners. */
@Injectable()
export class TournamentSyncStartRegistry implements OnApplicationShutdown {
  private readonly runtimes = new Map<number, TournamentSyncStartRuntime>();

  constructor(
    private readonly events: SyncStartEventsPublisher,
    private readonly completedSongs: CompletedSongSubmitter,
    @Inject(SYNCSTART_CLIENT_FACTORY)
    private readonly clientFactory: SyncStartClientFactory,
  ) {}

  configure(tournamentId: number, syncstartUrl: string): void {
    this.close(tournamentId);
    if (!syncstartUrl) return;

    this.runtimes.set(
      tournamentId,
      new TournamentSyncStartRuntime(
        tournamentId,
        syncstartUrl,
        [this.events, this.completedSongs],
        this.clientFactory,
      ),
    );
  }

  /** Creates a runtime only when the tournament has none, keeping live connections. */
  ensureConfigured(tournamentId: number, syncstartUrl: string): boolean {
    if (this.runtimes.has(tournamentId)) return false;
    this.configure(tournamentId, syncstartUrl);
    return this.runtimes.has(tournamentId);
  }

  close(tournamentId: number): void {
    this.runtimes.get(tournamentId)?.close();
    this.runtimes.delete(tournamentId);
  }

  connectServer(tournamentId: number): Promise<ConnectionStatus> {
    return this.runtime(tournamentId).connectServer();
  }

  disconnectServer(tournamentId: number): ConnectionStatus {
    return this.runtime(tournamentId).disconnectServer();
  }

  listLobbies(tournamentId: number) {
    return this.runtimes.get(tournamentId)?.listLobbies() ?? Promise.resolve({
      status: { isActive: false, isConnected: false },
      lobbies: [],
    });
  }

  connectLobby(request: {
    tournamentId: number;
    lobbyName: string;
    lobbyCode: string;
    password?: string;
  }): Promise<{ id: string }> {
    const { tournamentId, ...lobby } = request;
    return this.runtime(tournamentId).connectLobby(lobby);
  }

  createLobby(request: {
    tournamentId: number;
    lobbyName: string;
    password?: string;
  }): Promise<{ lobbyId: string; lobbyCode: string }> {
    const { tournamentId, ...lobby } = request;
    return this.runtime(tournamentId).createLobby(lobby);
  }

  disconnectLobby(tournamentId: number, lobbyId: string): void {
    this.runtime(tournamentId).disconnectLobby(lobbyId);
  }

  selectSong(tournamentId: number, lobbyId: string, songPath: string): Promise<void> {
    return this.runtime(tournamentId).selectSong(lobbyId, songPath);
  }

  startSong(tournamentId: number, lobbyId: string, songPath: string): Promise<void> {
    return this.runtime(tournamentId).startSong(lobbyId, songPath);
  }

  onApplicationShutdown(): void {
    for (const runtime of this.runtimes.values()) runtime.close();
    this.runtimes.clear();
  }

  private runtime(tournamentId: number): TournamentSyncStartRuntime {
    const runtime = this.runtimes.get(tournamentId);
    if (!runtime) {
      throw new Error(
        `No SyncStart runtime for tournament=${tournamentId}. Ensure the tournament has a syncstartUrl set.`,
      );
    }
    return runtime;
  }
}
