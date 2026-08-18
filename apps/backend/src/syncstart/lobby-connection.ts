import { WebSocket } from 'ws';

export type LobbyConnectionStatus = {
  isActive: boolean;
  isConnected: boolean;
};

export type LobbyConnectionCloseEvent = LobbyConnectionStatus & {
  code?: number;
  reason?: string;
};

export type LobbyConnectionOptions = {
  label: string;
  autoReconnect?: boolean;
  connectTimeoutMs?: number;
  reconnectDelayMs?: number;
  onOpen?: () => void | Promise<void>;
  onMessage?: (message: string) => void | Promise<void>;
  onClose?: (event: LobbyConnectionCloseEvent) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
};

export class LobbyConnection {
  private active = false;
  private connected = false;
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly syncstartUrl: string,
    private readonly options: LobbyConnectionOptions,
  ) {}

  Connect(): Promise<void> {
    if (this.IsConnected()) return Promise.resolve();

    this.active = true;
    this.clearReconnectTimer();
    this.closeCurrentSocket();
    return this.openSocket(true);
  }

  Disconnect(): void {
    this.active = false;
    this.connected = false;
    this.clearReconnectTimer();
    this.closeCurrentSocket();
    this.dispatchClose({ isActive: false, isConnected: false }).catch((err) =>
      console.error(`[LobbyConnection] Close callback failed: ${err?.message ?? err}`),
    );
  }

  Send(message: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.connected) {
      throw new Error('WebSocket is not connected');
    }
    this.ws.send(message);
  }

  IsActive(): boolean {
    return this.active;
  }

  IsConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  private openSocket(rejectInitialFailure: boolean): Promise<void> {
    const url = this.syncstartUrl;
    console.log(`[LobbyConnection] Opening WebSocket to ${url} (${this.options.label})`);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      let opened = false;
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.connected = false;
        if (rejectInitialFailure) this.active = false;
        ws.close();
        const error = new Error('Connection timeout');
        this.dispatchError(error);
        reject(error);
      }, this.options.connectTimeoutMs ?? 10000);

      ws.on('open', () => {
        if (this.ws !== ws) return;
        if (settled) return;
        opened = true;
        settled = true;
        clearTimeout(timeout);
        this.active = true;
        this.connected = true;
        this.dispatchOpen();
        resolve();
      });

      ws.on('message', (data: Buffer) => {
        if (this.ws !== ws) return;
        this.dispatchMessage(data.toString());
      });

      ws.on('close', (code, reason) => {
        if (this.ws !== ws) return;
        clearTimeout(timeout);
        this.ws = null;
        this.connected = false;

        const reasonText = reason?.toString() || undefined;
        if (!opened && rejectInitialFailure) {
          this.active = false;
          const error = new Error(`Connection refused, code=${code} reason=${reasonText ?? '(no reason)'}`);
          if (!settled) {
            settled = true;
            reject(error);
          }
          this.dispatchClose({ ...this.status(), code, reason: reasonText });
          return;
        }

        if (this.active && this.options.autoReconnect) {
          this.dispatchClose({ ...this.status(), code, reason: reasonText });
          this.scheduleReconnect();
          return;
        }

        this.active = false;
        this.dispatchClose({ ...this.status(), code, reason: reasonText });
      });

      ws.on('error', (error) => {
        if (this.ws !== ws) return;
        const err = error instanceof Error ? error : new Error(String(error));
        this.dispatchError(err);
        if (!opened && rejectInitialFailure && !settled) {
          settled = true;
          clearTimeout(timeout);
          this.active = false;
          this.connected = false;
          reject(err);
        }
      });
    });
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const delay = this.options.reconnectDelayMs ?? 5000;
    console.log(`[LobbyConnection] Scheduling reconnect in ${delay}ms (${this.options.label})`);
    this.reconnectTimer = setTimeout(() => {
      if (!this.active) return;
      this.openSocket(false).catch((err) =>
        console.error(`[LobbyConnection] Reconnect failed (${this.options.label}): ${err?.message ?? err}`),
      );
    }, delay);
  }

  private closeCurrentSocket(): void {
    const ws = this.ws;
    this.ws = null;
    if (ws) ws.close();
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private status(): LobbyConnectionStatus {
    return {
      isActive: this.IsActive(),
      isConnected: this.IsConnected(),
    };
  }

  private dispatchOpen(): void {
    Promise.resolve(this.options.onOpen?.()).catch((err) =>
      console.error(`[LobbyConnection] Open callback failed: ${err?.message ?? err}`),
    );
  }

  private dispatchMessage(message: string): void {
    Promise.resolve(this.options.onMessage?.(message)).catch((err) =>
      console.error(`[LobbyConnection] Message callback failed: ${err?.message ?? err}`),
    );
  }

  private dispatchClose(event: LobbyConnectionCloseEvent): Promise<void> {
    return Promise.resolve(this.options.onClose?.(event));
  }

  private dispatchError(error: Error): void {
    Promise.resolve(this.options.onError?.(error)).catch((err) =>
      console.error(`[LobbyConnection] Error callback failed: ${err?.message ?? err}`),
    );
  }
}
