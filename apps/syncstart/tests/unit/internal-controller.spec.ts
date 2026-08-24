import { InternalController } from "../../src/internal.controller";

describe("InternalController", () => {
  it("delegates every command to the tournament registry", async () => {
    const registry = {
      configure: jest.fn(), close: jest.fn(), connectServer: jest.fn().mockResolvedValue("connected"), disconnectServer: jest.fn().mockReturnValue("disconnected"),
      listLobbies: jest.fn().mockResolvedValue("lobbies"), connectLobby: jest.fn().mockResolvedValue("lobby"), createLobby: jest.fn().mockResolvedValue("created"), disconnectLobby: jest.fn(),
      selectSong: jest.fn().mockResolvedValue(undefined), startSong: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new InternalController(registry as any);
    expect(controller.configure("7", { syncstartUrl: "ws://sync" })).toEqual({ configured: true });
    expect(controller.close("7")).toEqual({ closed: true });
    await expect(controller.connect("7")).resolves.toBe("connected");
    expect(controller.disconnect("7")).toBe("disconnected");
    await expect(controller.lobbies("7")).resolves.toBe("lobbies");
    await expect(controller.connectLobby("7", { lobbyName: "Finals", lobbyCode: "ABCD" })).resolves.toBe("lobby");
    await expect(controller.createLobby("7", { lobbyName: "Finals" })).resolves.toBe("created");
    expect(controller.disconnectLobby("7", "ABCD")).toEqual({ ok: true });
    await expect(controller.selectSong("7", "ABCD", { songPath: "Pack/Song" })).resolves.toBeUndefined();
    await expect(controller.startSong("7", "ABCD", { songPath: "Pack/Song" })).resolves.toBeUndefined();
    expect(registry.connectLobby).toHaveBeenCalledWith({ tournamentId: 7, lobbyName: "Finals", lobbyCode: "ABCD" });
    expect(registry.disconnectLobby).toHaveBeenCalledWith(7, "ABCD");
    expect(registry.selectSong).toHaveBeenCalledWith(7, "ABCD", "Pack/Song");
    expect(registry.startSong).toHaveBeenCalledWith(7, "ABCD", "Pack/Song");
  });
});
