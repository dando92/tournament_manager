import {
  ILobbyObserver,
  LobbyIdentityDto,
} from "./lobby-observer.interface";
import { LobbyEventDispatcher } from "./lobby-event.dispatcher";
import { LobbyConnection, LobbyConnectionCloseEvent } from "./lobby-connection";
import {
  CreateLobbyRequestDto,
  LobbyConnectionResultDto,
  SpectateLobbyRequestDto,
  SyncStartLobbySummaryDto,
} from "./syncstart-connector.types";
import { SyncStartLobbyStatePayload } from "./syncstart-protocol.types";
import type { WebSocketFactory } from "./lobby-connection";
import { LobbySession, type LobbySessionMode, type PendingLobbyConnection } from "./lobby-session";

type SyncStartMessage<T = unknown> = {
  event: string;
  data?: T;
};

type SearchLobbyResponse = {
  lobbies?: SyncStartLobbySummaryDto[];
};

type PendingLobbySearch = {
  resolve: (lobbies: SyncStartLobbySummaryDto[]) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

export class SyncStartClient {
  private readonly dispatcher: LobbyEventDispatcher;
  private serverConnection: LobbyConnection | null = null;
  private serverTournamentId: number | null = null;
  private pendingLobbySearch: PendingLobbySearch | null = null;
  private connections = new Map<string, LobbySession>();

  constructor(
    private readonly syncstartUrl: string,
    observers: ILobbyObserver[],
    private readonly webSocketFactory?: WebSocketFactory,
  ) {
    this.dispatcher = new LobbyEventDispatcher(observers);
  }

  async CreateLobby(
    request: CreateLobbyRequestDto,
  ): Promise<LobbyConnectionResultDto> {
    const session = this.createLobbySession(
      { type: "create" },
      request.tournamentId,
      request.lobbyName,
      request.password ?? "",
    );
    const result = await this.connectLobbySession(session);
    this.connections.set(result.lobbyCode, session);
    return result;
  }

  async SpectateLobby(
    request: SpectateLobbyRequestDto,
  ): Promise<LobbyConnectionResultDto> {
    const normalizedLobbyCode = request.lobbyCode.toUpperCase();
    if (this.connections.has(normalizedLobbyCode)) {
      throw new Error(`Lobby ${normalizedLobbyCode} is already connected`);
    }

    const session = this.createLobbySession(
      { type: "spectate", lobbyCode: normalizedLobbyCode },
      request.tournamentId,
      request.lobbyName,
      request.password ?? "",
    );
    this.connections.set(normalizedLobbyCode, session);

    try {
      const result = await this.connectLobbySession(session);
      if (result.lobbyCode !== normalizedLobbyCode) {
        this.connections.delete(normalizedLobbyCode);
        this.connections.set(result.lobbyCode, session);
      }
      return result;
    } catch (error) {
      this.connections.delete(normalizedLobbyCode);
      throw error;
    }
  }

  async ChangeSong(): Promise<void> {
    throw new Error("ChangeSong is not implemented");
  }

  async ConnectToServer(
    tournamentId: number,
  ): Promise<{ isActive: boolean; isConnected: boolean }> {
    this.serverTournamentId = tournamentId;
    if (!this.serverConnection) {
      this.serverConnection = new LobbyConnection(this.syncstartUrl, {
        label: `server tournament=${tournamentId}`,
        onOpen: () => this.dispatchServerStatus(),
        onMessage: (message) => this.handleServerMessage(message),
        onClose: () => {
          this.rejectPendingLobbySearch(
            new Error("SyncStart server connection closed"),
          );
          return this.dispatchServerStatus();
        },
        onError: (error) => {
          this.rejectPendingLobbySearch(error);
        },
      }, this.webSocketFactory);
    }

    if (this.serverConnection.IsConnected()) return this.serverStatus();

    const connectPromise = this.serverConnection.Connect();
    await this.dispatchServerStatus();
    try {
      await connectPromise;
    } catch (error) {
      await this.dispatchServerStatus();
      throw error;
    }
    return this.serverStatus();
  }

  DisconnectFromServer(): { isActive: boolean; isConnected: boolean } {
    this.rejectPendingLobbySearch(new Error("SyncStart server disconnected"));
    this.serverConnection?.Disconnect();
    this.serverConnection = null;
    return this.serverStatus();
  }

  SearchLobbies(): Promise<SyncStartLobbySummaryDto[]> {
    if (!this.serverConnection?.IsConnected()) {
      return Promise.reject(new Error("SyncStart server is not connected"));
    }

    if (this.pendingLobbySearch) {
      return Promise.reject(new Error("Lobby search is already in progress"));
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingLobbySearch = null;
        reject(new Error("Lobby search timeout"));
      }, 10000);

      this.pendingLobbySearch = { resolve, reject, timeout };
      try {
        this.serverConnection?.Send(
          JSON.stringify({
            event: "searchLobby",
            data: { temporary: false },
          }),
        );
      } catch (error) {
        this.pendingLobbySearch = null;
        clearTimeout(timeout);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  IsActive(): boolean {
    return this.serverConnection?.IsActive() ?? false;
  }

  IsConnected(): boolean {
    return this.serverConnection?.IsConnected() ?? false;
  }

  LeaveLobby(lobbyCode: string): void {
    const normalizedLobbyCode = lobbyCode.toUpperCase();
    const session = this.connections.get(normalizedLobbyCode);
    if (!session) return;
    session.connection.Disconnect();
    this.connections.delete(normalizedLobbyCode);
  }

  DisconnectAll(): void {
    this.DisconnectFromServer();

    for (const [lobbyCode, session] of this.connections) {
      session.connection.Disconnect();
      this.connections.delete(lobbyCode);
    }
  }

  private createLobbySession(
    mode: LobbySessionMode,
    tournamentId: number,
    lobbyName: string | undefined,
    password: string,
  ): LobbySession {
    let session: LobbySession;
    const connection = new LobbyConnection(this.syncstartUrl, {
      label: `lobby mode=${mode.type}`,
      autoReconnect: mode.type === "spectate",
      onOpen: async () => {
        session.currentSocketConnectedNotified = false;
        await this.onLobbySocketOpen(session);
      },
      onMessage: (message) => this.handleLobbyMessage(session, message),
      onClose: (event) => this.handleLobbyClose(session, event),
      onError: (error) => {
        this.rejectPendingLobbyConnect(session, error);
      },
    });

    session = new LobbySession(
      mode,
      connection,
      tournamentId,
      lobbyName,
      password,
    );
    return session;
  }

  private async connectLobbySession(
    session: LobbySession,
  ): Promise<LobbyConnectionResultDto> {
    const pendingResult = this.waitForInitialLobbyState(session);
    const connectPromise = session.connection.Connect();
    await this.dispatchLobbyActive(session);

    try {
      await connectPromise;
      return await pendingResult;
    } catch (error) {
      this.rejectPendingLobbyConnect(
        session,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  private async dispatchLobbyActive(session: LobbySession): Promise<void> {
    const identity = this.currentIdentity(session);
    if (!identity) return;
    await this.dispatcher.OnConnectionActive({
      ...identity,
      isActive: session.connection.IsActive(),
      isConnected: session.connection.IsConnected(),
    });
  }

  private waitForInitialLobbyState(
    session: LobbySession,
  ): Promise<LobbyConnectionResultDto> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        session.pendingConnect = null;
        session.connection.Disconnect();
        reject(new Error("SyncStart lobby state timeout"));
      }, 10000);

      session.pendingConnect = { resolve, reject, timeout };
    });
  }

  private async onLobbySocketOpen(session: LobbySession): Promise<void> {
    if (session.mode.type === "create") {
      session.connection.Send(
        JSON.stringify({
          event: "createLobby",
          data: {
            machine: {},
            password: session.password,
          },
        }),
      );
      return;
    }

    await this.notifyConnected(session, session.mode.lobbyCode);
    session.connection.Send(
      JSON.stringify({
        event: "spectateLobby",
        data: {
          code: session.mode.lobbyCode,
          password: session.password,
          spectator: { profileName: "TournamentManager" },
        },
      }),
    );
  }

  private async handleLobbyMessage(
    session: LobbySession,
    message: string,
  ): Promise<void> {
    const payload = this.parseMessage(message);
    if (!payload) return;

    if (payload.event === "lobbyState") {
      await this.handleLobbyState(
        session,
        payload.data as SyncStartLobbyStatePayload,
      );
      return;
    }

    if (
      payload.event === "clientDisconnected" &&
      session.connection.IsActive()
    ) {
      const reason =
        (payload.data as { reason?: string })?.reason ?? "(no reason)";
      console.warn(
        `[SyncStartClient] clientDisconnected, reason="${reason}" (lobbyCode=${session.currentLobbyCode ?? "unknown"})`,
      );
      session.connection.Disconnect();
    }
  }

  private async handleLobbyState(
    session: LobbySession,
    lobbyState: SyncStartLobbyStatePayload,
  ): Promise<void> {
    const lobbyCode = lobbyState.code.toUpperCase();
    const previousLobbyCode = session.currentLobbyCode;
    session.currentLobbyCode = lobbyCode;

    if (previousLobbyCode && previousLobbyCode !== lobbyCode) {
      this.connections.delete(previousLobbyCode);
      this.connections.set(lobbyCode, session);
    }

    if (session.pendingConnect) {
      const pending = session.pendingConnect;
      session.pendingConnect = null;
      clearTimeout(pending.timeout);
      await this.notifyConnected(session, lobbyCode);
      await this.dispatchLobbyState(session, lobbyState);
      pending.resolve({ lobbyId: lobbyCode, lobbyCode });
      return;
    }

    await this.dispatchLobbyState(session, lobbyState);
  }

  private async handleLobbyClose(
    session: LobbySession,
    event: LobbyConnectionCloseEvent,
  ): Promise<void> {
    const lobbyCode = session.currentLobbyCode;
    this.rejectPendingLobbyConnect(
      session,
      new Error(
        `Connection closed, code=${event.code ?? "unknown"} reason=${event.reason ?? "(no reason)"}`,
      ),
    );

    if (!lobbyCode) return;

    await this.dispatcher.OnDisconnection({
      ...this.identity(session, lobbyCode),
      isActive: event.isActive,
      isConnected: event.isConnected,
    });

    if (!event.isActive) {
      this.connections.delete(lobbyCode);
    }
  }

  private async handleServerMessage(message: string): Promise<void> {
    const response = this.parseMessage<SearchLobbyResponse>(message);
    if (
      !response ||
      response.event !== "lobbySearched" ||
      !this.pendingLobbySearch
    )
      return;

    const pending = this.pendingLobbySearch;
    this.pendingLobbySearch = null;
    clearTimeout(pending.timeout);
    pending.resolve(response.data?.lobbies ?? []);
  }

  private parseMessage<T = unknown>(
    message: string,
  ): SyncStartMessage<T> | null {
    try {
      return JSON.parse(message) as SyncStartMessage<T>;
    } catch {
      console.warn(
        `[SyncStartClient] Unparseable message: ${message.slice(0, 200)}`,
      );
      return null;
    }
  }

  private async dispatchServerStatus(): Promise<void> {
    if (this.serverTournamentId === null) return;
    await this.dispatcher.OnSyncStartConnectionStatus({
      tournamentId: this.serverTournamentId,
      ...this.serverStatus(),
    });
  }

  private serverStatus(): { isActive: boolean; isConnected: boolean } {
    return {
      isActive: this.IsActive(),
      isConnected: this.IsConnected(),
    };
  }

  private rejectPendingLobbySearch(error: Error): void {
    if (!this.pendingLobbySearch) return;
    const pending = this.pendingLobbySearch;
    this.pendingLobbySearch = null;
    clearTimeout(pending.timeout);
    pending.reject(error);
  }

  private rejectPendingLobbyConnect(session: LobbySession, error: Error): void {
    if (!session.pendingConnect) return;
    const pending = session.pendingConnect;
    session.pendingConnect = null;
    clearTimeout(pending.timeout);
    pending.reject(error);
  }

  private async dispatchLobbyState(
    session: LobbySession,
    lobbyState: SyncStartLobbyStatePayload,
  ): Promise<void> {
    const lobbyCode = lobbyState.code.toUpperCase();
    const identity = this.identity(session, lobbyCode);
    for (const transition of session.stateInterpreter.interpret(lobbyState)) {
      if (transition.type === "song-selected") await this.dispatcher.OnSongSelected({ ...identity, song: transition.song });
      if (transition.type === "player-ready") await this.dispatcher.OnPlayerReady({ ...identity, playerId: transition.playerId, playerName: transition.playerName, ready: transition.ready });
      if (transition.type === "match-update") await this.dispatcher.OnGoingMatchUpdate({ ...identity, song: transition.song, players: transition.players });
      if (transition.type === "song-completed") await this.dispatcher.OnSongCompleted({ ...identity, song: transition.song, scores: transition.scores });
    }
  }

  private async notifyConnected(
    session: LobbySession,
    lobbyCode: string,
  ): Promise<void> {
    if (session.currentSocketConnectedNotified) return;
    session.currentSocketConnectedNotified = true;
    await this.dispatcher.OnConnected({
      ...this.identity(session, lobbyCode.toUpperCase()),
      isActive: true,
      isConnected: true,
    });
  }

  private identity(session: LobbySession, lobbyCode: string): LobbyIdentityDto {
    return {
      tournamentId: session.tournamentId,
      lobbyId: lobbyCode,
      lobbyCode,
      lobbyName: session.lobbyName || lobbyCode,
    };
  }

  private currentIdentity(session: LobbySession): LobbyIdentityDto | null {
    return session.currentLobbyCode
      ? this.identity(session, session.currentLobbyCode)
      : null;
  }

}

export type SyncStartClientFactory = (
  syncstartUrl: string,
  observers: ILobbyObserver[],
) => SyncStartClient;

export const defaultSyncStartClientFactory: SyncStartClientFactory =
  (syncstartUrl, observers) => new SyncStartClient(syncstartUrl, observers);

export type {
  CreateLobbyRequestDto,
  LobbyConnectionResultDto,
  SpectateLobbyRequestDto,
  SyncStartLobbySummaryDto,
} from "./syncstart-connector.types";
