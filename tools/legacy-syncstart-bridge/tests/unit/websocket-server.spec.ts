import { WebSocket } from "ws";
import type { BridgeConfig } from "../../src/config";
import { Logger } from "../../src/observability/logger";
import { SyncStartCompatibilityServer } from "../../src/syncstart/websocket-server";
import type {
  BridgeLobbyView,
  SyncStartLobbyState,
} from "../../src/syncstart/syncstart.types";

const baseConfig: BridgeConfig = {
  udpPort: 53000,
  udpAllowedSources: [],
  webSocketPort: 0,
  maxPayloadBytes: 65536,
  heartbeatIntervalMs: 30000,
  lobbyCode: "BRDG",
  lobbyPassword: "",
  finalGraceMs: 1500,
  finalTimeoutMs: 20000,
  logLevel: "error",
};

const lobbyState: SyncStartLobbyState = {
  code: "BRDG",
  spectators: [],
  players: [
    {
      playerId: "P1",
      profileName: "Alice",
      screenName: "ScreenGameplay",
      ready: true,
      exScore: 95.45,
      isFailed: false,
    },
  ],
  songInfo: {
    songPath: "5guys1pack/Earthquake",
    title: "5guys1pack/Earthquake",
    artist: "",
    songLength: 0,
  },
};

function lobbyView(password: string): BridgeLobbyView {
  return {
    code: "BRDG",
    isPasswordProtected: password !== "",
    matchesPassword: (candidate) => candidate === password,
    state: () => lobbyState,
  };
}

type Client = {
  socket: WebSocket;
  next(): Promise<{ event: string; data: Record<string, unknown> }>;
  send(message: unknown): void;
  close(): void;
};

async function connect(port: number): Promise<Client> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  const received: string[] = [];
  const waiting: Array<(message: string) => void> = [];

  socket.on("message", (raw) => {
    const message = raw.toString();
    const resolve = waiting.shift();
    if (resolve) resolve(message);
    else received.push(message);
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });

  return {
    socket,
    next: async () => {
      const message =
        received.shift() ??
        (await new Promise<string>((resolve) => waiting.push(resolve)));
      return JSON.parse(message) as {
        event: string;
        data: Record<string, unknown>;
      };
    },
    send: (message) => socket.send(JSON.stringify(message)),
    close: () => socket.close(),
  };
}

describe("SyncStartCompatibilityServer", () => {
  let server: SyncStartCompatibilityServer;
  let port: number;
  const clients: Client[] = [];

  async function start(password = ""): Promise<void> {
    server = new SyncStartCompatibilityServer(
      { ...baseConfig, lobbyPassword: password },
      new Logger("error"),
      lobbyView(password),
    );
    port = await server.listening();
  }

  async function client(): Promise<Client> {
    const connected = await connect(port);
    clients.push(connected);
    return connected;
  }

  afterEach(async () => {
    for (const connected of clients.splice(0)) connected.close();
    await server.close();
  });

  it("answers createLobby with the state of the virtual lobby", async () => {
    await start();
    const connected = await client();

    connected.send({
      event: "createLobby",
      data: { machine: {}, password: "" },
    });

    await expect(connected.next()).resolves.toEqual({
      event: "lobbyState",
      data: lobbyState,
    });
  });

  it("lets a spectator in with the right code and password", async () => {
    await start("secret");
    const connected = await client();

    connected.send({
      event: "spectateLobby",
      data: {
        code: "brdg",
        password: "secret",
        spectator: { profileName: "TournamentManager" },
      },
    });

    await expect(connected.next()).resolves.toEqual({
      event: "lobbyState",
      data: lobbyState,
    });
  });

  it("refuses a spectator with the wrong password", async () => {
    await start("secret");
    const connected = await client();

    connected.send({
      event: "spectateLobby",
      data: { code: "BRDG", password: "wrong" },
    });

    await expect(connected.next()).resolves.toMatchObject({
      event: "responseStatus",
      data: { event: "spectateLobby", success: false },
    });
  });

  it("refuses a spectator asking for a lobby that does not exist", async () => {
    await start();
    const connected = await client();

    connected.send({
      event: "spectateLobby",
      data: { code: "ZZZZ", password: "" },
    });

    await expect(connected.next()).resolves.toMatchObject({
      event: "responseStatus",
      data: { event: "spectateLobby", success: false },
    });
  });

  it("lists the virtual lobby for a search", async () => {
    await start("secret");
    const connected = await client();

    connected.send({ event: "searchLobby", data: { temporary: false } });

    await expect(connected.next()).resolves.toEqual({
      event: "lobbySearched",
      data: {
        lobbies: [
          {
            code: "BRDG",
            isPasswordProtected: true,
            playerCount: 1,
            spectatorCount: 0,
          },
        ],
      },
    });
  });

  it("publishes lobby state to attached clients and stops after they leave", async () => {
    await start();
    const connected = await client();

    connected.send({
      event: "createLobby",
      data: { machine: {}, password: "" },
    });
    await connected.next();

    server.broadcast(lobbyState);
    await expect(connected.next()).resolves.toMatchObject({
      event: "lobbyState",
    });

    connected.send({ event: "leaveLobby", data: {} });
    await expect(connected.next()).resolves.toEqual({
      event: "lobbyLeft",
      data: { left: true },
    });

    server.broadcast(lobbyState);
    connected.send({ event: "lobbyState", data: {} });
    await expect(connected.next()).resolves.toMatchObject({
      event: "lobbyState",
    });
  });

  it("answers an unsupported event instead of staying silent", async () => {
    await start();
    const connected = await client();

    connected.send({ event: "selectSong", data: {} });

    await expect(connected.next()).resolves.toMatchObject({
      event: "responseStatus",
      data: { event: "selectSong", success: false },
    });
  });
});
