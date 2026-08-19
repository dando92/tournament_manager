import type { ILobbyObserver } from "@syncstart/protocol/lobby-observer.interface";
import { SyncStartConnector } from "@syncstart/protocol/syncstart-connector";
import { SyncStartProtocolSimulator } from "@syncstart/testing/syncstart-protocol.simulator";

describe("SyncStartConnector protocol boundary", () => {
  jest.setTimeout(15000);
  let simulator: SyncStartProtocolSimulator;

  afterEach(async () => {
    await simulator?.close();
  });

  it("normalizes valid protocol input, ignores malformed and duplicate completion messages", async () => {
    simulator = new SyncStartProtocolSimulator();
    const observer: ILobbyObserver = {
      OnSongSelected: jest.fn(),
      OnGoingMatchUpdate: jest.fn(),
      OnSongCompleted: jest.fn(),
    };
    const connector = new SyncStartConnector(await simulator.url(), [observer]);
    await connector.SpectateLobby({
      tournamentId: 7,
      lobbyName: "Finals",
      lobbyCode: "abcd",
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(observer.OnSongSelected).toHaveBeenCalledTimes(1);
    expect(observer.OnGoingMatchUpdate).toHaveBeenCalledTimes(1);
    expect(observer.OnSongCompleted).toHaveBeenCalledTimes(1);
    expect(observer.OnSongCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        tournamentId: 7,
        lobbyCode: "ABCD",
        scores: [
          expect.objectContaining({ playerName: "Player One", score: 1000 }),
        ],
      }),
    );
    connector.DisconnectAll();
  });

  it("searches lobbies through the deterministic server protocol", async () => {
    simulator = new SyncStartProtocolSimulator();
    const connector = new SyncStartConnector(await simulator.url(), []);
    await connector.ConnectToServer(7);
    await expect(connector.SearchLobbies()).resolves.toEqual([
      {
        code: "abcd",
        isPasswordProtected: false,
        playerCount: 2,
        spectatorCount: 1,
      },
    ]);
    connector.DisconnectAll();
  });

  it("reconnects an active spectated lobby after a server disconnect", async () => {
    simulator = new SyncStartProtocolSimulator({
      disconnectFirstLobbyConnection: true,
    });
    const observer: ILobbyObserver = { OnConnected: jest.fn() };
    const connector = new SyncStartConnector(await simulator.url(), [observer]);
    await connector.SpectateLobby({
      tournamentId: 7,
      lobbyName: "Finals",
      lobbyCode: "ABCD",
    });
    await new Promise((resolve) => setTimeout(resolve, 5300));
    expect(observer.OnConnected).toHaveBeenCalledTimes(2);
    connector.DisconnectAll();
  });
});
