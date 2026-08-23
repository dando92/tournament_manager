import { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import type { BridgeConfig } from "../config";
import type { Logger } from "../observability/logger";
import type {
  BridgeLobbyView,
  SyncStartLobbyState,
  SyncStartOutgoingMessage,
} from "./syncstart.types";

type IncomingMessage = {
  event?: unknown;
  data?: {
    code?: unknown;
    password?: unknown;
  };
};

/**
 * The SyncStart server Tournament Manager thinks it is talking to.
 *
 * Only the four events it actually sends are implemented — it opens one
 * connection to search for lobbies and another to create or spectate one — and
 * anything else is answered with a failed `responseStatus` rather than
 * dropped, so a client waiting for a reply learns that it will not get one.
 *
 * The virtual lobby exists before anybody connects and outlives every
 * connection: it belongs to the cabinet on the LAN, not to a client. So
 * `spectateLobby` verifies a code and a password and never creates a lobby of
 * its own, and `createLobby` attaches the caller to the same one.
 */
export class SyncStartCompatibilityServer {
  private readonly server: WebSocketServer;
  private readonly attached = new Set<WebSocket>();
  private readonly alive = new Set<WebSocket>();
  private readonly heartbeat: NodeJS.Timeout;

  constructor(
    private readonly config: BridgeConfig,
    private readonly logger: Logger,
    private readonly lobby: BridgeLobbyView,
  ) {
    this.server = new WebSocketServer({
      port: config.webSocketPort,
      maxPayload: config.maxPayloadBytes,
    });
    this.server.on("connection", (socket) => this.handleConnection(socket));
    this.server.on("error", (error) =>
      this.logger.error("WebSocket server error", { error: error.message }),
    );
    this.heartbeat = setInterval(
      () => this.dropDeadConnections(),
      config.heartbeatIntervalMs,
    );
    this.heartbeat.unref?.();
  }

  async listening(): Promise<number> {
    if (!this.server.address()) {
      await new Promise<void>((resolve) =>
        this.server.once("listening", resolve),
      );
    }
    return (this.server.address() as AddressInfo).port;
  }

  /** Every attached client sees the lobby the cabinet is in, as it changes. */
  broadcast(state: SyncStartLobbyState): void {
    for (const socket of this.attached)
      this.send(socket, { event: "lobbyState", data: state });
  }

  close(): Promise<void> {
    clearInterval(this.heartbeat);
    for (const client of this.server.clients) client.terminate();
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  private handleConnection(socket: WebSocket): void {
    this.alive.add(socket);
    this.logger.info("Client connected");

    socket.on("pong", () => this.alive.add(socket));
    socket.on("message", (raw) => this.handleMessage(socket, raw.toString()));
    socket.on("close", () => {
      this.attached.delete(socket);
      this.alive.delete(socket);
      this.logger.info("Client disconnected");
    });
    socket.on("error", (error) =>
      this.logger.warn("Client connection error", { error: error.message }),
    );
  }

  private handleMessage(socket: WebSocket, raw: string): void {
    const message = this.parse(raw);
    if (!message) {
      this.logger.warn("Ignoring unparseable client message", {
        message: raw.slice(0, 200),
      });
      return;
    }

    const event = typeof message.event === "string" ? message.event : "";
    switch (event) {
      case "createLobby":
        return this.attach(socket, event);
      case "spectateLobby":
        return this.spectate(socket, message);
      case "searchLobby":
        return this.send(socket, {
          event: "lobbySearched",
          data: {
            lobbies: [
              {
                code: this.lobby.code,
                isPasswordProtected: this.lobby.isPasswordProtected,
                playerCount: this.lobby.state().players.length,
                spectatorCount: this.attached.size,
              },
            ],
          },
        });
      case "lobbyState":
        return this.send(socket, {
          event: "lobbyState",
          data: this.lobby.state(),
        });
      case "leaveLobby":
        this.attached.delete(socket);
        return this.send(socket, { event: "lobbyLeft", data: { left: true } });
      default:
        this.logger.warn("Unsupported client event", { event });
        return this.fail(
          socket,
          event,
          "Event is not supported by the legacy bridge",
        );
    }
  }

  private spectate(socket: WebSocket, message: IncomingMessage): void {
    const code = String(message.data?.code ?? "").toUpperCase();
    const password =
      typeof message.data?.password === "string" ? message.data.password : "";

    if (code !== this.lobby.code) {
      return this.fail(socket, "spectateLobby", `Lobby ${code} does not exist`);
    }
    if (!this.lobby.matchesPassword(password)) {
      return this.fail(socket, "spectateLobby", "Incorrect password");
    }
    this.attach(socket, "spectateLobby");
  }

  private attach(socket: WebSocket, event: string): void {
    this.attached.add(socket);
    this.logger.info("Client attached to the virtual lobby", {
      event,
      lobbyCode: this.lobby.code,
    });
    this.send(socket, { event: "lobbyState", data: this.lobby.state() });
  }

  private fail(socket: WebSocket, event: string, message: string): void {
    this.send(socket, {
      event: "responseStatus",
      data: { event, success: false, message },
    });
  }

  private send(socket: WebSocket, message: SyncStartOutgoingMessage): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(message));
  }

  /**
   * A cabinet room loses connections without closing them. A client that has
   * not answered a ping since the previous round is terminated, so the lobby
   * does not keep publishing to a socket nobody is reading.
   */
  private dropDeadConnections(): void {
    for (const socket of this.server.clients) {
      if (!this.alive.has(socket)) {
        this.attached.delete(socket);
        socket.terminate();
        continue;
      }
      this.alive.delete(socket);
      socket.ping();
    }
  }

  private parse(raw: string): IncomingMessage | null {
    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as IncomingMessage)
        : null;
    } catch {
      return null;
    }
  }
}
