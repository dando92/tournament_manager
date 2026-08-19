import { SyncStartEventsPublisher } from "../../src/syncstart-events.publisher";

describe("SyncStartEventsPublisher", () => {
  it.each([
    ["OnSyncStartConnectionStatus", "syncstart.connection-status"], ["OnConnectionActive", "syncstart.lobby-active"],
    ["OnConnected", "syncstart.lobby-connected"], ["OnDisconnection", "syncstart.lobby-disconnected"],
    ["OnSongSelected", "syncstart.song-selected"], ["OnGoingMatchUpdate", "syncstart.match-update"],
    ["OnPlayerReady", "syncstart.player-ready"], ["OnSongCompleted", "syncstart.song-completed-live"],
  ])("publishes %s as %s", async (method, type) => {
    const live = { publish: jest.fn().mockResolvedValue(undefined) };
    const publisher = new SyncStartEventsPublisher(live as any);
    const payload = { tournamentId: 7 };
    await (publisher as any)[method](payload);
    expect(live.publish).toHaveBeenCalledWith({ type, tournamentId: 7, payload });
  });

  it("publishes command results", async () => {
    const live = { publish: jest.fn().mockResolvedValue(undefined) };
    const publisher = new SyncStartEventsPublisher(live as any);
    await publisher.publishCommandResult(7, { commandId: "c1", ok: true });
    expect(live.publish).toHaveBeenCalledWith(expect.objectContaining({ type: "syncstart.command-result", tournamentId: 7 }));
  });
});
