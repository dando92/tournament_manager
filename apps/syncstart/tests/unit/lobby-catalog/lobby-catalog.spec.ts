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
});
