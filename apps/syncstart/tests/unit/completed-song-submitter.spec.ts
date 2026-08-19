import { of } from "rxjs";
import { CompletedSongSubmitter } from "../../src/completed-song-submitter";

describe("CompletedSongSubmitter", () => {
  const event = { tournamentId: 7, lobbyId: "ABCD", lobbyCode: "ABCD", lobbyName: "Finals", song: { songPath: "Songs/Test", title: "Test", artist: "Artist", songLength: 120 }, scores: [{ playerId: "P1", playerName: "Player", score: 1000, exScore: 99, isFailed: false }] };
  const config = { getOrThrow: jest.fn((key: string) => key === "API_INTERNAL_URL" ? "http://api" : "secret") };

  it("submits a deterministic completed-song request", async () => {
    const http = { post: jest.fn().mockReturnValue(of({ status: 201 })) };
    await new CompletedSongSubmitter(http as any, config as any).OnSongCompleted(event);
    expect(http.post).toHaveBeenCalledWith("http://api/internal/syncstart/completed-songs", expect.objectContaining({ completionId: "7:ABCD:Songs/Test:P1:99" }), { headers: { "x-internal-service-token": "secret" } });
  });

  it("fails when the internal API rejects the submission", async () => {
    const http = { post: jest.fn().mockReturnValue(of({ status: 500 })) };
    await expect(new CompletedSongSubmitter(http as any, config as any).OnSongCompleted(event)).rejects.toThrow("HTTP 500");
  });
});
