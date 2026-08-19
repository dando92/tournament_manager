import { LobbyCatalog } from "../../../src/lobby-catalog";

describe("LobbyCatalog", () => {
  it("merges observed lobby metadata with remote search results", () => {
    const catalog = new LobbyCatalog();
    catalog.OnConnected({
      tournamentId: 7,
      lobbyId: "ABCD",
      lobbyCode: "ABCD",
      lobbyName: "Finals",
      isActive: true,
      isConnected: true,
    });

    expect(
      catalog.list(7, [
        {
          code: "abcd",
          isPasswordProtected: true,
          playerCount: 2,
          spectatorCount: 1,
        },
      ]),
    ).toEqual([
      {
        id: "ABCD",
        name: "Finals",
        lobbyCode: "ABCD",
        isPasswordProtected: true,
        playerCount: 2,
        spectatorCount: 1,
      },
    ]);
  });

  it("retains active disconnections and removes inactive or closed tournament lobbies", () => {
    const catalog = new LobbyCatalog();
    const event = { tournamentId: 7, lobbyId: "ABCD", lobbyCode: "ABCD", lobbyName: "Finals", isActive: true, isConnected: false };
    catalog.OnConnectionActive(event);
    catalog.OnDisconnection(event);
    expect(catalog.list(7, [])).toHaveLength(1);
    catalog.OnDisconnection({ ...event, isActive: false });
    expect(catalog.list(7, [])).toEqual([]);
    catalog.OnConnected({ ...event, lobbyCode: "EFGH", lobbyId: "EFGH", isConnected: true });
    catalog.removeTournament(7);
    expect(catalog.list(7, [])).toEqual([]);
  });
});
