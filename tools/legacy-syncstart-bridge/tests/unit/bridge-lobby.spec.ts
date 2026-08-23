import type { BridgeConfig } from "../../src/config";
import { LegacyBridgeLobby } from "../../src/domain/bridge-lobby";
import {
  parseLegacyScoreMessage,
  type LegacyScoreMessage,
} from "../../src/legacy/score-message";
import { Logger } from "../../src/observability/logger";
import type { SyncStartLobbyState } from "../../src/syncstart/syncstart.types";
import {
  emptyLegacyPayload,
  legacyPayload,
  type LegacyPayloadOverrides,
} from "./legacy-payload";

const config: BridgeConfig = {
  udpPort: 53000,
  udpAllowedSources: [],
  webSocketPort: 1337,
  maxPayloadBytes: 65536,
  heartbeatIntervalMs: 30000,
  lobbyCode: "BRDG",
  lobbyPassword: "",
  finalGraceMs: 1500,
  finalTimeoutMs: 20000,
  logLevel: "error",
};

function parsed(payload: string): LegacyScoreMessage {
  const message = parseLegacyScoreMessage(payload);
  if (!message) throw new Error("fixture payload must parse");
  return message;
}

function lobbyUnderTest(): {
  lobby: LegacyBridgeLobby;
  published: SyncStartLobbyState[];
} {
  const published: SyncStartLobbyState[] = [];
  const lobby = new LegacyBridgeLobby(config, new Logger("error"), (state) =>
    published.push(state),
  );
  return { lobby, published };
}

function screens(published: SyncStartLobbyState[]): string[] {
  return published.map((state) => state.players[0]?.screenName ?? "no-players");
}

const alice: LegacyPayloadOverrides = { playerNumber: 0, playerName: "Alice" };
const bob: LegacyPayloadOverrides = { playerNumber: 1, playerName: "Bob" };

describe("LegacyBridgeLobby", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("publishes the selected song as the lobby's song", () => {
    const { lobby, published } = lobbyUnderTest();

    lobby.handleSong("5guys1pack/Earthquake");

    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      code: "BRDG",
      players: [],
      spectators: [],
      songInfo: {
        songPath: "5guys1pack/Earthquake",
        title: "5guys1pack/Earthquake",
        artist: "",
        songLength: 0,
      },
    });
  });

  it("holds a player back from ready until something has been judged", () => {
    const { lobby, published } = lobbyUnderTest();

    lobby.handleScore(parsed(emptyLegacyPayload(alice)));
    expect(published.at(-1)?.players[0]).toMatchObject({
      playerId: "P1",
      profileName: "Alice",
      screenName: "ScreenGameplay",
      ready: false,
    });

    lobby.handleScore(parsed(legacyPayload(alice)));
    expect(published.at(-1)?.players[0]).toMatchObject({
      ready: true,
      exScore: 95.45,
    });
  });

  it("keeps both sides of a cabinet in one lobby state", () => {
    const { lobby, published } = lobbyUnderTest();

    lobby.handleScore(parsed(legacyPayload(alice)));
    lobby.handleScore(
      parsed(legacyPayload({ ...bob, formattedScore: "88.10" })),
    );
    lobby.handleScore(
      parsed(legacyPayload({ ...alice, formattedScore: "96.00" })),
    );

    expect(published.at(-1)?.players).toEqual([
      expect.objectContaining({
        playerId: "P1",
        profileName: "Alice",
        exScore: 96,
      }),
      expect.objectContaining({
        playerId: "P2",
        profileName: "Bob",
        exScore: 88.1,
      }),
    ]);
  });

  it("reports a completed song as gameplay followed by evaluation, once both players finish", () => {
    const { lobby, published } = lobbyUnderTest();

    lobby.handleScore(parsed(legacyPayload(alice)));
    lobby.handleScore(parsed(legacyPayload(bob)));
    const beforeCompletion = published.length;

    lobby.handleFinalScore(parsed(legacyPayload(alice)), legacyPayload(alice));
    jest.advanceTimersByTime(config.finalGraceMs + 1);
    expect(published).toHaveLength(beforeCompletion);

    const bobFinal = legacyPayload({
      ...bob,
      formattedScore: "91.00",
      isFailed: true,
    });
    lobby.handleFinalScore(parsed(bobFinal), bobFinal);
    jest.advanceTimersByTime(config.finalGraceMs + 1);

    expect(screens(published.slice(beforeCompletion))).toEqual([
      "ScreenGameplay",
      "ScreenEvaluation",
    ]);
    expect(published.at(-1)?.players).toEqual([
      expect.objectContaining({
        playerId: "P1",
        exScore: 95.45,
        isFailed: false,
      }),
      expect.objectContaining({ playerId: "P2", exScore: 91, isFailed: true }),
    ]);
  });

  it("reports a completion even when the cabinet only broadcasts final scores", () => {
    const { lobby, published } = lobbyUnderTest();
    const payload = legacyPayload(alice);

    lobby.handleSong("5guys1pack/Earthquake");
    lobby.handleFinalScore(parsed(payload), payload);
    jest.advanceTimersByTime(config.finalGraceMs + 1);

    expect(screens(published)).toEqual([
      "no-players",
      "ScreenGameplay",
      "ScreenEvaluation",
    ]);
    expect(published.at(-1)?.players[0]).toMatchObject({
      playerId: "P1",
      exScore: 95.45,
      judgments: expect.objectContaining({
        fantasticPlus: 120,
        fantastics: 44,
      }),
    });
  });

  it("leaves a player who never finished out of the completion", () => {
    const { lobby, published } = lobbyUnderTest();
    const aliceFinal = legacyPayload(alice);

    lobby.handleScore(parsed(legacyPayload(alice)));
    lobby.handleScore(parsed(legacyPayload(bob)));
    lobby.handleFinalScore(parsed(aliceFinal), aliceFinal);

    jest.advanceTimersByTime(config.finalTimeoutMs + 1);

    expect(screens(published).slice(-2)).toEqual([
      "ScreenGameplay",
      "ScreenEvaluation",
    ]);
    expect(published.at(-1)?.players).toEqual([
      expect.objectContaining({ playerId: "P1" }),
    ]);
  });

  it("ignores a repeated final datagram", () => {
    const { lobby, published } = lobbyUnderTest();
    const payload = legacyPayload(alice);

    lobby.handleFinalScore(parsed(payload), payload);
    jest.advanceTimersByTime(config.finalGraceMs + 1);
    const completed = published.length;

    lobby.handleFinalScore(parsed(payload), payload);
    jest.advanceTimersByTime(config.finalTimeoutMs + 1);

    expect(published).toHaveLength(completed);
  });

  it("starts a new session when the cabinet moves to another song", () => {
    const { lobby, published } = lobbyUnderTest();

    lobby.handleScore(parsed(legacyPayload(alice)));
    lobby.handleScore(parsed(legacyPayload(bob)));
    lobby.handleSong("otherpack/Another");

    expect(published.at(-1)).toMatchObject({
      players: [],
      songInfo: expect.objectContaining({ songPath: "otherpack/Another" }),
    });
  });

  it("does not carry a finished song's players into the next play of the same song", () => {
    const { lobby, published } = lobbyUnderTest();
    const first = legacyPayload({ ...alice, formattedScore: "95.45" });
    const second = legacyPayload({ ...alice, formattedScore: "97.00" });

    lobby.handleFinalScore(parsed(first), first);
    jest.advanceTimersByTime(config.finalGraceMs + 1);
    lobby.handleFinalScore(parsed(second), second);
    jest.advanceTimersByTime(config.finalGraceMs + 1);

    expect(screens(published)).toEqual([
      "ScreenGameplay",
      "ScreenEvaluation",
      "ScreenGameplay",
      "ScreenEvaluation",
    ]);
    expect(published.at(-1)?.players[0]).toMatchObject({ exScore: 97 });
  });
});
