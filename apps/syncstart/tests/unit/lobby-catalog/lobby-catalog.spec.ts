import { LobbyCatalog } from "../../../src/lobby-catalog";

describe("LobbyCatalog", () => {
  it("owns one tournament projection and merges remote discovery", () => {
    const catalog = new LobbyCatalog(7);
    catalog.OnConnected({
      tournamentId: 7,
      lobbyId: "ABCD",
      lobbyCode: "ABCD",
      lobbyName: "Finals",
      isActive: true,
      isConnected: true,
    });

    expect(catalog.list([{
      code: "abcd",
      isPasswordProtected: true,
      playerCount: 2,
      spectatorCount: 1,
    }])).toEqual([{
      id: "ABCD",
      name: "Finals",
      lobbyCode: "ABCD",
      isPasswordProtected: true,
      playerCount: 2,
      spectatorCount: 1,
    }]);
  });

  it("retains active disconnections and removes inactive lobbies", () => {
    const catalog = new LobbyCatalog(7);
    const event = {
      tournamentId: 7,
      lobbyId: "ABCD",
      lobbyCode: "ABCD",
      lobbyName: "Finals",
      isActive: true,
      isConnected: false,
    };
    catalog.OnConnectionActive(event);
    catalog.OnDisconnection(event);
    expect(catalog.list([])).toHaveLength(1);
    catalog.OnDisconnection({ ...event, isActive: false });
    expect(catalog.list([])).toEqual([]);
  });

  it("rejects events owned by another tournament and can be cleared", () => {
    const catalog = new LobbyCatalog(7);
    expect(() => catalog.OnConnected({
      tournamentId: 8,
      lobbyId: "ABCD",
      lobbyCode: "ABCD",
      lobbyName: "Finals",
      isActive: true,
      isConnected: true,
    })).toThrow("tournament 8 lobby event to tournament 7 catalog");

    catalog.OnConnected({
      tournamentId: 7,
      lobbyId: "ABCD",
      lobbyCode: "ABCD",
      lobbyName: "Finals",
      isActive: true,
      isConnected: true,
    });
    catalog.clear();
    expect(catalog.list([])).toEqual([]);
  });
});
