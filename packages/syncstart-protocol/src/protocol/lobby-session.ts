import {
  LobbyConnection,
  type LobbyConnectionCloseEvent,
  type WebSocketFactory,
} from "./lobby-connection";
import { LobbyStateInterpreter } from "./lobby-state-interpreter";
import type {
  ILobbyObserver,
  LobbyIdentityDto,
} from "./lobby-observer.interface";
import type { LobbyConnectionResultDto } from "./syncstart-connector.types";
import type { SyncStartLobbyStatePayload } from "./syncstart-protocol.types";

export type LobbySessionMode =
  | { type: "create" }
  | { type: "spectate"; lobbyCode: string };

export interface LobbySessionOwner {
  onLobbyCodeChanged(
    session: LobbySession,
    previousLobbyCode: string | null,
    lobbyCode: string,
  ): void;
  onLobbyClosed(session: LobbySession): void;
}

type PendingLobbyConnection = {
  resolve: (result: LobbyConnectionResultDto) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type PendingLobbyCommand = {
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type SyncStartMessage<T = unknown> = {
  event: string;
  data?: T;
};

/** Owns the identity, protocol state, and transport lifecycle of one lobby. */
export class LobbySession {
  private readonly connection: LobbyConnection;
  private readonly stateInterpreter = new LobbyStateInterpreter();
  private currentLobbyCode: string | null;
  private pendingConnect: PendingLobbyConnection | null = null;
  private readonly pendingCommands = new Map<string, PendingLobbyCommand>();
  private connectedNotificationSent = false;

  constructor(
    private readonly tournamentId: number,
    private readonly syncstartUrl: string,
    private readonly mode: LobbySessionMode,
    private readonly lobbyName: string | undefined,
    private readonly password: string,
    private readonly observer: ILobbyObserver,
    private readonly owner: LobbySessionOwner,
    webSocketFactory?: WebSocketFactory,
  ) {
    this.currentLobbyCode = mode.type === "spectate" ? mode.lobbyCode : null;
    this.connection = new LobbyConnection(
      syncstartUrl,
      {
        label: `lobby mode=${mode.type}`,
        autoReconnect: mode.type === "spectate",
        onOpen: () => this.handleOpen(),
        onMessage: (message) => this.handleMessage(message),
        onClose: (event) => this.handleClose(event),
        onError: (error) => this.rejectPendingConnect(error),
      },
      webSocketFactory,
    );
  }

  get lobbyCode(): string | null {
    return this.currentLobbyCode;
  }

  async connect(): Promise<LobbyConnectionResultDto> {
    const pendingResult = this.waitForInitialState();
    const connectPromise = this.connection.Connect();
    await this.dispatchConnectionActive();

    try {
      await connectPromise;
      return await pendingResult;
    } catch (error) {
      this.rejectPendingConnect(
        error instanceof Error ? error : new Error(String(error)),
      );
      await pendingResult.catch(() => undefined);
      throw error;
    }
  }

  disconnect(): void {
    this.rejectPendingConnect(new Error("SyncStart lobby disconnected"));
    this.rejectPendingCommands(new Error("SyncStart lobby disconnected"));
    this.connection.Disconnect();
  }

  changeSong(songPath: string): Promise<void> {
    return this.sendCommand("changeSong", songPath);
  }

  startSong(songPath: string): Promise<void> {
    return this.sendCommand("startSong", songPath);
  }

  private waitForInitialState(): Promise<LobbyConnectionResultDto> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingConnect = null;
        this.connection.Disconnect();
        reject(new Error("SyncStart lobby state timeout"));
      }, 10000);
      this.pendingConnect = { resolve, reject, timeout };
    });
  }

  private async handleOpen(): Promise<void> {
    this.connectedNotificationSent = false;
    if (this.mode.type === "create") {
      this.connection.Send(JSON.stringify({
        event: "createLobby",
        data: { machine: {}, password: this.password },
      }));
      return;
    }

    await this.notifyConnected(this.mode.lobbyCode);
    this.connection.Send(JSON.stringify({
      event: "spectateLobby",
      data: {
        code: this.mode.lobbyCode,
        password: this.password,
        spectator: { profileName: "TournamentManager" },
      },
    }));
  }

  private async handleMessage(message: string): Promise<void> {
    const payload = this.parseMessage(message);
    if (!payload) return;

    if (payload.event === "lobbyState") {
      await this.handleLobbyState(payload.data as SyncStartLobbyStatePayload);
      return;
    }
    if (payload.event === "responseStatus") {
      this.handleCommandResponse(payload.data as {
        event?: string;
        success?: boolean;
        message?: string;
      });
      return;
    }
    if (payload.event === "clientDisconnected" && this.connection.IsActive()) {
      const reason = (payload.data as { reason?: string })?.reason ?? "(no reason)";
      console.warn(
        `[LobbySession] clientDisconnected, reason="${reason}" (lobbyCode=${this.currentLobbyCode ?? "unknown"})`,
      );
      this.connection.Disconnect();
    }
  }

  private async handleLobbyState(lobbyState: SyncStartLobbyStatePayload): Promise<void> {
    const lobbyCode = lobbyState.code.toUpperCase();
    const previousLobbyCode = this.currentLobbyCode;
    this.currentLobbyCode = lobbyCode;

    try {
      this.owner.onLobbyCodeChanged(this, previousLobbyCode, lobbyCode);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      this.rejectPendingConnect(failure);
      this.connection.Disconnect();
      throw failure;
    }

    if (this.pendingConnect) {
      const pending = this.pendingConnect;
      this.pendingConnect = null;
      clearTimeout(pending.timeout);
      await this.notifyConnected(lobbyCode);
      await this.dispatchLobbyState(lobbyState);
      pending.resolve({ lobbyId: lobbyCode, lobbyCode });
      return;
    }
    await this.dispatchLobbyState(lobbyState);
  }

  private async handleClose(event: LobbyConnectionCloseEvent): Promise<void> {
    this.rejectPendingConnect(new Error(
      `Connection closed, code=${event.code ?? "unknown"} reason=${event.reason ?? "(no reason)"}`,
    ));
    this.rejectPendingCommands(new Error("SyncStart lobby connection closed"));

    if (this.currentLobbyCode) {
      await this.observer.OnDisconnection?.({
        ...this.identity(this.currentLobbyCode),
        isActive: event.isActive,
        isConnected: event.isConnected,
      });
    }
    if (!event.isActive) this.owner.onLobbyClosed(this);
  }

  private async dispatchConnectionActive(): Promise<void> {
    if (!this.currentLobbyCode) return;
    await this.observer.OnConnectionActive?.({
      ...this.identity(this.currentLobbyCode),
      isActive: this.connection.IsActive(),
      isConnected: this.connection.IsConnected(),
    });
  }

  private async dispatchLobbyState(lobbyState: SyncStartLobbyStatePayload): Promise<void> {
    const identity = this.identity(lobbyState.code.toUpperCase());
    for (const transition of this.stateInterpreter.interpret(lobbyState)) {
      if (transition.type === "song-selected")
        await this.observer.OnSongSelected?.({ ...identity, song: transition.song });
      if (transition.type === "player-ready")
        await this.observer.OnPlayerReady?.({
          ...identity,
          playerId: transition.playerId,
          playerName: transition.playerName,
          ready: transition.ready,
        });
      if (transition.type === "match-update")
        await this.observer.OnGoingMatchUpdate?.({
          ...identity,
          song: transition.song,
          players: transition.players,
        });
      if (transition.type === "song-completed")
        await this.observer.OnSongCompleted?.({
          ...identity,
          song: transition.song,
          scores: transition.scores,
        });
    }
  }

  private async notifyConnected(lobbyCode: string): Promise<void> {
    if (this.connectedNotificationSent) return;
    this.connectedNotificationSent = true;
    await this.observer.OnConnected?.({
      ...this.identity(lobbyCode.toUpperCase()),
      isActive: true,
      isConnected: true,
    });
  }

  private identity(lobbyCode: string): LobbyIdentityDto {
    return {
      tournamentId: this.tournamentId,
      lobbyId: lobbyCode,
      lobbyCode,
      lobbyName: this.lobbyName || lobbyCode,
    };
  }

  private rejectPendingConnect(error: Error): void {
    if (!this.pendingConnect) return;
    const pending = this.pendingConnect;
    this.pendingConnect = null;
    clearTimeout(pending.timeout);
    pending.reject(error);
  }

  private sendCommand(event: string, songPath: string): Promise<void> {
    if (!songPath.trim()) return Promise.reject(new Error("Song path is required"));
    if (this.pendingCommands.has(event)) {
      return Promise.reject(new Error(`${event} is already pending for lobby ${this.currentLobbyCode ?? "unknown"}`));
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(event);
        reject(new Error(`${event} response timeout`));
      }, 5000);
      this.pendingCommands.set(event, { resolve, reject, timeout });
      try {
        this.connection.Send(JSON.stringify({ event, data: { songPath } }));
      } catch (error) {
        clearTimeout(timeout);
        this.pendingCommands.delete(event);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private handleCommandResponse(data: { event?: string; success?: boolean; message?: string }): void {
    if (!data.event) return;
    const pending = this.pendingCommands.get(data.event);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pendingCommands.delete(data.event);
    if (data.success) pending.resolve();
    else pending.reject(new Error(data.message || `${data.event} failed`));
  }

  private rejectPendingCommands(error: Error): void {
    for (const pending of this.pendingCommands.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingCommands.clear();
  }

  private parseMessage(message: string): SyncStartMessage | null {
    try {
      return JSON.parse(message) as SyncStartMessage;
    } catch {
      console.warn(`[LobbySession] Unparseable message: ${message.slice(0, 200)}`);
      return null;
    }
  }
}
