import { LobbyStateInterpreter } from "../../../src";

const state = (screenName: "ScreenGameplay" | "ScreenEvaluation") => ({
  code: "ABCD",
  spectators: [],
  songInfo: { songPath: "Songs/Test", title: "Test", artist: "Artist", songLength: 120 },
  players: [{ playerId: "P1" as const, profileName: "[DS] Player One", ready: true, score: 1000, exScore: 99, isFailed: false, screenName }],
});

describe("LobbyStateInterpreter", () => {
  it("normalizes gameplay and emits a completion once per score signature", () => {
    const interpreter = new LobbyStateInterpreter();
    const gameplay = interpreter.interpret(state("ScreenGameplay"));
    const completed = interpreter.interpret(state("ScreenEvaluation"));
    const duplicate = interpreter.interpret(state("ScreenEvaluation"));

    expect(gameplay.map((event) => event.type)).toEqual(["song-selected", "player-ready", "player-ready", "match-update"]);
    expect(completed).toEqual([expect.objectContaining({ type: "song-completed", scores: [expect.objectContaining({ playerName: "Player One" })] })]);
    expect(duplicate).toEqual([]);
  });
});
