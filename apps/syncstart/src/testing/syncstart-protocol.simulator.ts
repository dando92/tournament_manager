import { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer } from "ws";

type SimulatorOptions = { disconnectFirstLobbyConnection?: boolean };

export class SyncStartProtocolSimulator {
  private readonly server: WebSocketServer;
  private lobbyConnections = 0;

  constructor(
    private readonly options: SimulatorOptions & { port?: number } = {},
  ) {
    this.server = new WebSocketServer({ port: options.port ?? 0 });
    this.server.on("connection", (socket) => this.handleConnection(socket));
  }

  async url(): Promise<string> {
    if (!this.server.address())
      await new Promise<void>((resolve) =>
        this.server.once("listening", resolve),
      );
    return `ws://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  close(): Promise<void> {
    for (const client of this.server.clients) client.terminate();
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  private handleConnection(socket: WebSocket): void {
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString()) as { event: string };
      if (message.event === "searchLobby") {
        socket.send(
          JSON.stringify({
            event: "lobbySearched",
            data: {
              lobbies: [
                {
                  code: "abcd",
                  isPasswordProtected: false,
                  playerCount: 2,
                  spectatorCount: 1,
                },
              ],
            },
          }),
        );
        return;
      }
      if (
        message.event === "spectateLobby" ||
        message.event === "createLobby"
      ) {
        this.lobbyConnections += 1;
        if (
          this.options.disconnectFirstLobbyConnection &&
          this.lobbyConnections === 1
        ) {
          this.sendSongSequence(socket);
          setTimeout(() => socket.close(1012, "simulated restart"), 30);
          return;
        }
        socket.send("{malformed");
        this.sendSongSequence(socket);
      }
    });
  }

  private sendSongSequence(socket: WebSocket): void {
    const songInfo = {
      songPath: "Songs/Test",
      title: "Test Song",
      artist: "Test Artist",
      songLength: 120,
    };
    const player = {
      playerId: "P1",
      profileName: "[DS] Player One",
      ready: true,
      score: 1000,
      exScore: 99,
      isFailed: false,
    };
    const send = (screenName: string) =>
      socket.send(
        JSON.stringify({
          event: "lobbyState",
          data: {
            code: "ABCD",
            spectators: [],
            songInfo,
            players: [{ ...player, screenName }],
          },
        }),
      );
    send("ScreenGameplay");
    setTimeout(() => {
      send("ScreenEvaluation");
      send("ScreenEvaluation");
    }, 10);
  }
}
