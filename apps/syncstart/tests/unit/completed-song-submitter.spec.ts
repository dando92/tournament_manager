import { CompletedSongSubmitter } from "../../src/completed-song-submitter";

describe("CompletedSongSubmitter", () => {
  const event = { tournamentId: 7, lobbyId: "ABCD", lobbyCode: "ABCD", lobbyName: "Finals", song: { songPath: "Songs/Test", title: "Test", artist: "Artist", songLength: 120 }, scores: [{ playerId: "P1", playerName: "Player", score: 1000, exScore: 99, isFailed: false }] };
  const config = { getOrThrow: jest.fn((key: string) => key === "API_INTERNAL_URL" ? "http://api" : "secret") };
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it("submits a deterministic completed-song request", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
    await new CompletedSongSubmitter(config as any).OnSongCompleted(event);
    expect(global.fetch).toHaveBeenCalledWith("http://api/internal/syncstart/completed-songs", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "x-internal-service-token": "secret" }), body: expect.stringContaining('"completionId":"7:ABCD:Songs/Test:P1:99"') }));
  });
  it("fails when the internal API rejects the submission", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as any;
    await expect(new CompletedSongSubmitter(config as any).OnSongCompleted(event)).rejects.toThrow("HTTP 500");
  });
});
