import { TournamentSyncStartRegistry } from "../../src/tournament-syncstart-registry";

describe("TournamentSyncStartRegistry", () => {
  const client = () => ({
    DisconnectAll: jest.fn(), ConnectToServer: jest.fn().mockResolvedValue({ isActive: true, isConnected: true }),
    DisconnectFromServer: jest.fn().mockReturnValue({ isActive: false, isConnected: false }),
    IsActive: jest.fn().mockReturnValue(true), IsConnected: jest.fn().mockReturnValue(true),
    SearchLobbies: jest.fn().mockResolvedValue([]), SpectateLobby: jest.fn().mockResolvedValue({ lobbyId: "ABCD", lobbyCode: "ABCD" }),
    CreateLobby: jest.fn().mockResolvedValue({ lobbyId: "ABCD", lobbyCode: "ABCD" }), LeaveLobby: jest.fn(),
  });

  it("creates one client per configuration and delegates all operations", async () => {
    const catalog = { list: jest.fn().mockReturnValue([]), removeTournament: jest.fn() };
    const factory = jest.fn(() => client());
    const registry = new TournamentSyncStartRegistry(catalog as any, {} as any, {} as any, factory as any);
    registry.configure(7, "ws://syncstart");
    const created = factory.mock.results[0].value;

    await expect(registry.connectServer(7)).resolves.toEqual({ isActive: true, isConnected: true });
    await expect(registry.listLobbies(7)).resolves.toEqual({ status: { isActive: true, isConnected: true }, lobbies: [] });
    await expect(registry.connectLobby({ tournamentId: 7, lobbyName: "Finals", lobbyCode: "abcd" })).resolves.toEqual({ id: "ABCD" });
    await expect(registry.createLobby({ tournamentId: 7, lobbyName: "Finals" })).resolves.toEqual({ lobbyId: "ABCD", lobbyCode: "ABCD" });
    registry.disconnectLobby(7, "ABCD");
    expect(created.SpectateLobby).toHaveBeenCalledWith(expect.objectContaining({ lobbyCode: "ABCD", password: "" }));
    expect(created.LeaveLobby).toHaveBeenCalledWith("ABCD");
    expect(created.CreateLobby).toHaveBeenCalledWith(expect.objectContaining({ password: "" }));
  });

  it("closes replaced clients and all clients during shutdown", () => {
    const catalog = { list: jest.fn(), removeTournament: jest.fn() };
    const first = client(); const second = client();
    const factory = jest.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const registry = new TournamentSyncStartRegistry(catalog as any, {} as any, {} as any, factory as any);
    registry.configure(7, "ws://one");
    registry.configure(7, "ws://two");
    registry.onApplicationShutdown();
    expect(first.DisconnectAll).toHaveBeenCalledTimes(1);
    expect(second.DisconnectAll).toHaveBeenCalledTimes(1);
    expect(catalog.removeTournament).toHaveBeenCalledWith(7);
  });
});
