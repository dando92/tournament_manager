import { WebSocket } from "ws";
import {
  LobbySession,
  type LobbySessionOwner,
  type WebSocketTransport,
} from "../../../src";

describe("LobbySession", () => {
  it("owns connection handshake, identity, protocol transitions, and shutdown", async () => {
    const transport = new FakeWebSocketTransport();
    const observer = {
      OnConnectionActive: jest.fn(),
      OnConnected: jest.fn(),
      OnSongSelected: jest.fn(),
      OnGoingMatchUpdate: jest.fn(),
      OnDisconnection: jest.fn(),
    };
    const owner: LobbySessionOwner = {
      onLobbyCodeChanged: jest.fn(),
      onLobbyClosed: jest.fn(),
    };
    const factory = jest.fn(() => transport);
    const session = new LobbySession(
      7,
      "ws://syncstart",
      { type: "spectate", lobbyCode: "ABCD" },
      "Finals",
      "secret",
      observer,
      owner,
      factory,
    );

    const connected = session.connect();
    transport.open();
    await flushCallbacks();
    expect(transport.sent).toContain(JSON.stringify({
      event: "spectateLobby",
      data: {
        code: "ABCD",
        password: "secret",
        spectator: { profileName: "TournamentManager" },
      },
    }));

    transport.message(JSON.stringify({
      event: "lobbyState",
      data: {
        code: "abcd",
        spectators: [],
        songInfo: {
          songPath: "Songs/Test",
          title: "Test",
          artist: "Artist",
          songLength: 120,
        },
        players: [{
          playerId: "P1",
          profileName: "Player",
          ready: true,
          score: 1000,
          exScore: 99,
          isFailed: false,
          screenName: "ScreenGameplay",
        }],
      },
    }));

    await expect(connected).resolves.toEqual({ lobbyId: "ABCD", lobbyCode: "ABCD" });
    expect(session.lobbyCode).toBe("ABCD");
    expect(owner.onLobbyCodeChanged).toHaveBeenCalledWith(session, "ABCD", "ABCD");
    expect(observer.OnConnected).toHaveBeenCalledTimes(1);
    expect(observer.OnSongSelected).toHaveBeenCalledWith(
      expect.objectContaining({ tournamentId: 7, lobbyId: "ABCD" }),
    );
    expect(observer.OnGoingMatchUpdate).toHaveBeenCalledTimes(1);

    session.disconnect();
    await flushCallbacks();
    expect(observer.OnDisconnection).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false, isConnected: false }),
    );
    expect(owner.onLobbyClosed).toHaveBeenCalledWith(session);
    expect(factory).toHaveBeenCalledWith("ws://syncstart");
  });

  it("rejects ownership collisions without exposing mutable session state", async () => {
    const transport = new FakeWebSocketTransport();
    const owner: LobbySessionOwner = {
      onLobbyCodeChanged: jest.fn(() => {
        throw new Error("Lobby ABCD is already connected");
      }),
      onLobbyClosed: jest.fn(),
    };
    const session = new LobbySession(
      7,
      "ws://syncstart",
      { type: "create" },
      undefined,
      "",
      {},
      owner,
      () => transport,
    );

    const connected = session.connect();
    transport.open();
    transport.message(JSON.stringify({
      event: "lobbyState",
      data: { code: "ABCD", spectators: [], players: [] },
    }));

    await expect(connected).rejects.toThrow("Lobby ABCD is already connected");
  });
});

class FakeWebSocketTransport implements WebSocketTransport {
  readyState = WebSocket.CONNECTING;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, Array<(...args: any[]) => void>>();

  send(message: string): void {
    this.sent.push(message);
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
    this.emit("close", 1000, Buffer.from("closed"));
  }

  on(event: string, listener: (...args: any[]) => void): void {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  open(): void {
    this.readyState = WebSocket.OPEN;
    this.emit("open");
  }

  message(message: string): void {
    this.emit("message", Buffer.from(message));
  }

  private emit(event: string, ...args: any[]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }
}

function flushCallbacks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
