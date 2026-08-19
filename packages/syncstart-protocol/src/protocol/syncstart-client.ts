import type { ILobbyObserver } from "./lobby-observer.interface";
import { LobbyEventDispatcher } from "./lobby-event.dispatcher";
import type { WebSocketFactory } from "./lobby-connection";
import {
  LobbySession,
  type LobbySessionMode,
  type LobbySessionOwner,
} from "./lobby-session";
import { SyncStartServerSession } from "./syncstart-server-session";
import type {
  CreateLobbyRequestDto,
  LobbyConnectionResultDto,
  SpectateLobbyRequestDto,
  SyncStartLobbySummaryDto,
} from "./syncstart-connector.types";

/** Coordinates one tournament's server session and independently owned lobby sessions. */
export class SyncStartClient implements LobbySessionOwner {
  private readonly dispatcher: LobbyEventDispatcher;
  private readonly server: SyncStartServerSession;
  private readonly lobbySessions = new Set<LobbySession>();
  private readonly lobbySessionsByCode = new Map<string, LobbySession>();

  constructor(
    readonly tournamentId: number,
    private readonly syncstartUrl: string,
    observers: ILobbyObserver[],
    private readonly webSocketFactory?: WebSocketFactory,
  ) {
    this.dispatcher = new LobbyEventDispatcher(observers);
    this.server = new SyncStartServerSession(
      tournamentId,
      syncstartUrl,
      this.dispatcher,
      webSocketFactory,
    );
  }

  async CreateLobby(request: CreateLobbyRequestDto): Promise<LobbyConnectionResultDto> {
    const session = this.createLobbySession(
      { type: "create" },
      request.lobbyName,
      request.password ?? "",
    );
    return this.connectLobbySession(session);
  }

  async SpectateLobby(request: SpectateLobbyRequestDto): Promise<LobbyConnectionResultDto> {
    const lobbyCode = request.lobbyCode.toUpperCase();
    if (this.lobbySessionsByCode.has(lobbyCode)) {
      throw new Error(`Lobby ${lobbyCode} is already connected`);
    }

    const session = this.createLobbySession(
      { type: "spectate", lobbyCode },
      request.lobbyName,
      request.password ?? "",
    );
    this.lobbySessionsByCode.set(lobbyCode, session);
    return this.connectLobbySession(session);
  }

  async ChangeSong(): Promise<void> {
    throw new Error("ChangeSong is not implemented");
  }

  ConnectToServer() {
    return this.server.connect();
  }

  DisconnectFromServer() {
    return this.server.disconnect();
  }

  SearchLobbies(): Promise<SyncStartLobbySummaryDto[]> {
    return this.server.searchLobbies();
  }

  IsActive(): boolean {
    return this.server.status().isActive;
  }

  IsConnected(): boolean {
    return this.server.status().isConnected;
  }

  LeaveLobby(lobbyCode: string): void {
    const session = this.lobbySessionsByCode.get(lobbyCode.toUpperCase());
    if (!session) return;
    session.disconnect();
    this.removeLobbySession(session);
  }

  DisconnectAll(): void {
    this.server.disconnect();
    for (const session of [...this.lobbySessions]) session.disconnect();
    this.lobbySessions.clear();
    this.lobbySessionsByCode.clear();
  }

  onLobbyCodeChanged(
    session: LobbySession,
    previousLobbyCode: string | null,
    lobbyCode: string,
  ): void {
    const normalizedLobbyCode = lobbyCode.toUpperCase();
    const existing = this.lobbySessionsByCode.get(normalizedLobbyCode);
    if (existing && existing !== session) {
      throw new Error(`Lobby ${normalizedLobbyCode} is already connected`);
    }
    if (
      previousLobbyCode &&
      this.lobbySessionsByCode.get(previousLobbyCode.toUpperCase()) === session
    ) {
      this.lobbySessionsByCode.delete(previousLobbyCode.toUpperCase());
    }
    this.lobbySessionsByCode.set(normalizedLobbyCode, session);
  }

  onLobbyClosed(session: LobbySession): void {
    this.removeLobbySession(session);
  }

  private createLobbySession(
    mode: LobbySessionMode,
    lobbyName: string | undefined,
    password: string,
  ): LobbySession {
    const session = new LobbySession(
      this.tournamentId,
      this.syncstartUrl,
      mode,
      lobbyName,
      password,
      this.dispatcher,
      this,
      this.webSocketFactory,
    );
    this.lobbySessions.add(session);
    return session;
  }

  private async connectLobbySession(
    session: LobbySession,
  ): Promise<LobbyConnectionResultDto> {
    try {
      return await session.connect();
    } catch (error) {
      session.disconnect();
      this.removeLobbySession(session);
      throw error;
    }
  }

  private removeLobbySession(session: LobbySession): void {
    this.lobbySessions.delete(session);
    for (const [lobbyCode, registered] of this.lobbySessionsByCode) {
      if (registered === session) this.lobbySessionsByCode.delete(lobbyCode);
    }
  }
}

export type SyncStartClientFactory = (
  tournamentId: number,
  syncstartUrl: string,
  observers: ILobbyObserver[],
) => SyncStartClient;

export const defaultSyncStartClientFactory: SyncStartClientFactory =
  (tournamentId, syncstartUrl, observers) =>
    new SyncStartClient(tournamentId, syncstartUrl, observers);

export type {
  CreateLobbyRequestDto,
  LobbyConnectionResultDto,
  SpectateLobbyRequestDto,
  SyncStartLobbySummaryDto,
} from "./syncstart-connector.types";
