import type { ILobbyObserver } from "./lobby-observer.interface";
import {
  LobbyConnection,
  type LobbyConnectionStatus,
  type WebSocketFactory,
} from "./lobby-connection";
import type { SyncStartLobbySummaryDto } from "./syncstart-connector.types";

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

/** Owns the SyncStart server connection and its request correlation state. */
export class SyncStartServerSession {
  private readonly connection: LobbyConnection;
  private pendingSearch: PendingLobbySearch | null = null;

  constructor(
    private readonly tournamentId: number,
    syncstartUrl: string,
    private readonly observer: ILobbyObserver,
    webSocketFactory?: WebSocketFactory,
  ) {
    this.connection = new LobbyConnection(
      syncstartUrl,
      {
        label: `server tournament=${tournamentId}`,
        onOpen: () => this.dispatchStatus(),
        onMessage: (message) => this.handleMessage(message),
        onClose: () => {
          this.rejectPendingSearch(new Error("SyncStart server connection closed"));
          return this.dispatchStatus();
        },
        onError: (error) => this.rejectPendingSearch(error),
      },
      webSocketFactory,
    );
  }

  async connect(): Promise<LobbyConnectionStatus> {
    if (this.connection.IsConnected()) return this.status();

    const connectPromise = this.connection.Connect();
    await this.dispatchStatus();
    try {
      await connectPromise;
    } catch (error) {
      await this.dispatchStatus();
      throw error;
    }
    return this.status();
  }

  disconnect(): LobbyConnectionStatus {
    this.rejectPendingSearch(new Error("SyncStart server disconnected"));
    this.connection.Disconnect();
    return this.status();
  }

  searchLobbies(): Promise<SyncStartLobbySummaryDto[]> {
    if (!this.connection.IsConnected()) {
      return Promise.reject(new Error("SyncStart server is not connected"));
    }
    if (this.pendingSearch) {
      return Promise.reject(new Error("Lobby search is already in progress"));
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingSearch = null;
        reject(new Error("Lobby search timeout"));
      }, 10000);

      this.pendingSearch = { resolve, reject, timeout };
      try {
        this.connection.Send(JSON.stringify({
          event: "searchLobby",
          data: { temporary: false },
        }));
      } catch (error) {
        this.pendingSearch = null;
        clearTimeout(timeout);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  status(): LobbyConnectionStatus {
    return {
      isActive: this.connection.IsActive(),
      isConnected: this.connection.IsConnected(),
    };
  }

  private async handleMessage(message: string): Promise<void> {
    const response = this.parseMessage<SearchLobbyResponse>(message);
    if (response?.event !== "lobbySearched" || !this.pendingSearch) return;

    const pending = this.pendingSearch;
    this.pendingSearch = null;
    clearTimeout(pending.timeout);
    pending.resolve(response.data?.lobbies ?? []);
  }

  private parseMessage<T>(message: string): SyncStartMessage<T> | null {
    try {
      return JSON.parse(message) as SyncStartMessage<T>;
    } catch {
      console.warn(
        `[SyncStartServerSession] Unparseable message: ${message.slice(0, 200)}`,
      );
      return null;
    }
  }

  private dispatchStatus(): Promise<void> {
    return Promise.resolve(this.observer.OnSyncStartConnectionStatus?.({
      tournamentId: this.tournamentId,
      ...this.status(),
    }));
  }

  private rejectPendingSearch(error: Error): void {
    if (!this.pendingSearch) return;
    const pending = this.pendingSearch;
    this.pendingSearch = null;
    clearTimeout(pending.timeout);
    pending.reject(error);
  }
}
