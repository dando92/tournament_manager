import { TournamentSyncStartRegistry } from "../../src/tournament-syncstart-registry";

describe("TournamentSyncStartRegistry", () => {
  const client = () => ({
    DisconnectAll: jest.fn(),
    ConnectToServer: jest.fn().mockResolvedValue({ isActive: true, isConnected: true }),
    DisconnectFromServer: jest.fn().mockReturnValue({ isActive: false, isConnected: false }),
    IsActive: jest.fn().mockReturnValue(true),
    IsConnected: jest.fn().mockReturnValue(true),
    SearchLobbies: jest.fn().mockResolvedValue([]),
    SpectateLobby: jest.fn().mockResolvedValue({ lobbyId: "ABCD", lobbyCode: "ABCD" }),
    CreateLobby: jest.fn().mockResolvedValue({ lobbyId: "ABCD", lobbyCode: "ABCD" }),
    LeaveLobby: jest.fn(),
  });

  it("creates an isolated runtime per tournament and delegates operations", async () => {
    const events = {};
    const completedSongs = {};
    const factory = jest.fn(() => client());
    const registry = new TournamentSyncStartRegistry(
      events as any,
      completedSongs as any,
      factory as any,
    );
    registry.configure(7, "ws://syncstart");
    const created = factory.mock.results[0].value;

    expect(factory).toHaveBeenCalledWith(
      7,
      "ws://syncstart",
      [expect.anything(), events, completedSongs],
    );
    await expect(registry.connectServer(7)).resolves.toEqual({
      isActive: true,
      isConnected: true,
    });
    await expect(registry.listLobbies(7)).resolves.toEqual({
      status: { isActive: true, isConnected: true },
      lobbies: [],
    });
    await expect(registry.connectLobby({
      tournamentId: 7,
      lobbyName: "Finals",
      lobbyCode: "abcd",
    })).resolves.toEqual({ id: "ABCD" });
    await expect(registry.createLobby({
      tournamentId: 7,
      lobbyName: "Finals",
    })).resolves.toEqual({ lobbyId: "ABCD", lobbyCode: "ABCD" });
    registry.disconnectLobby(7, "ABCD");

    expect(created.SpectateLobby).toHaveBeenCalledWith(
      expect.objectContaining({ lobbyCode: "ABCD", password: "" }),
    );
    expect(created.CreateLobby).toHaveBeenCalledWith(
      expect.objectContaining({ password: "" }),
    );
    expect(created.LeaveLobby).toHaveBeenCalledWith("ABCD");
  });

  it("keeps unconfigured tournaments independent", async () => {
    const registry = new TournamentSyncStartRegistry(
      {} as any,
      {} as any,
      jest.fn(() => client()) as any,
    );
    registry.configure(7, "ws://syncstart");

    await expect(registry.listLobbies(8)).resolves.toEqual({
      status: { isActive: false, isConnected: false },
      lobbies: [],
    });
    expect(() => registry.disconnectLobby(8, "ABCD"))
      .toThrow("No SyncStart runtime for tournament=8");
  });

  it("reconstructs only tournaments without a live runtime", () => {
    const factory = jest.fn(() => client());
    const registry = new TournamentSyncStartRegistry(
      {} as any,
      {} as any,
      factory as any,
    );

    expect(registry.ensureConfigured(7, "ws://syncstart")).toBe(true);
    expect(registry.ensureConfigured(7, "ws://replacement")).toBe(false);
    expect(registry.ensureConfigured(8, "")).toBe(false);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("closes replaced runtimes and every runtime during shutdown", () => {
    const first = client();
    const second = client();
    const factory = jest.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const registry = new TournamentSyncStartRegistry(
      {} as any,
      {} as any,
      factory as any,
    );
    registry.configure(7, "ws://one");
    registry.configure(7, "ws://two");
    registry.onApplicationShutdown();

    expect(first.DisconnectAll).toHaveBeenCalledTimes(1);
    expect(second.DisconnectAll).toHaveBeenCalledTimes(1);
  });
});
