import type { BridgeConfig } from "../../src/config";
import { LegacyBridgeLobby, MAX_MACHINES } from "../../src/domain/bridge-lobby";
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
  machineIdleMs: 600000,
  logLevel: "error",
};

/** The cabinets of the room, addressed the way their datagrams arrive. */
const CABINET_A = "192.168.1.10";
const CABINET_B = "192.168.1.11";
const CABINET_C = "192.168.1.12";

function parsed(payload: string): LegacyScoreMessage {
  const message = parseLegacyScoreMessage(payload);
  if (!message) throw new Error("fixture payload must parse");
  return message;
}

function lobbyUnderTest(overrides: Partial<BridgeConfig> = {}): {
  lobby: LegacyBridgeLobby;
  published: SyncStartLobbyState[];
} {
  const published: SyncStartLobbyState[] = [];
  const lobby = new LegacyBridgeLobby(
    { ...config, ...overrides },
    new Logger("error"),
    (state) => published.push(state),
  );
  return { lobby, published };
}

function screens(published: SyncStartLobbyState[]): string[] {
  return published.map((state) => state.players[0]?.screenName ?? "no-players");
}

function names(state: SyncStartLobbyState | undefined): string[] {
  return (state?.players ?? []).map((player) => player.profileName);
}

const alice: LegacyPayloadOverrides = { playerNumber: 0, playerName: "Alice" };
const bob: LegacyPayloadOverrides = { playerNumber: 1, playerName: "Bob" };

describe("LegacyBridgeLobby", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("publishes the selected song as the lobby's song", () => {
    const { lobby, published } = lobbyUnderTest();

    lobby.handleSong(CABINET_A, "5guys1pack/Earthquake");

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

    lobby.handleScore(CABINET_A, parsed(emptyLegacyPayload(alice)));
    expect(published.at(-1)?.players[0]).toMatchObject({
      playerId: "P1",
      profileName: "Alice",
      screenName: "ScreenGameplay",
      ready: false,
    });

    lobby.handleScore(CABINET_A, parsed(legacyPayload(alice)));
    expect(published.at(-1)?.players[0]).toMatchObject({
      ready: true,
      exScore: 95.45,
    });
  });

  it("keeps both sides of a cabinet in one lobby state", () => {
    const { lobby, published } = lobbyUnderTest();

    lobby.handleScore(CABINET_A, parsed(legacyPayload(alice)));
    lobby.handleScore(
      CABINET_A,
      parsed(legacyPayload({ ...bob, formattedScore: "88.10" })),
    );
    lobby.handleScore(
      CABINET_A,
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

    lobby.handleScore(CABINET_A, parsed(legacyPayload(alice)));
    lobby.handleScore(CABINET_A, parsed(legacyPayload(bob)));
    const beforeCompletion = published.length;

    lobby.handleFinalScore(
      CABINET_A,
      parsed(legacyPayload(alice)),
      legacyPayload(alice),
    );
    jest.advanceTimersByTime(config.finalGraceMs + 1);
    expect(published).toHaveLength(beforeCompletion);

    const bobFinal = legacyPayload({
      ...bob,
      formattedScore: "91.00",
      isFailed: true,
    });
    lobby.handleFinalScore(CABINET_A, parsed(bobFinal), bobFinal);
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

    lobby.handleSong(CABINET_A, "5guys1pack/Earthquake");
    lobby.handleFinalScore(CABINET_A, parsed(payload), payload);
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

    lobby.handleScore(CABINET_A, parsed(legacyPayload(alice)));
    lobby.handleScore(CABINET_A, parsed(legacyPayload(bob)));
    lobby.handleFinalScore(CABINET_A, parsed(aliceFinal), aliceFinal);

    jest.advanceTimersByTime(config.finalTimeoutMs + 1);

    expect(screens(published).slice(-2)).toEqual([
      "ScreenGameplay",
      "ScreenEvaluation",
    ]);
    expect(published.at(-1)?.players).toEqual([
      expect.objectContaining({ playerId: "P1" }),
    ]);
  });

  it("stops waiting for a player once their skipped song is reported", () => {
    const { lobby, published } = lobbyUnderTest();
    const aliceFinal = legacyPayload(alice);
    const bobSkip = emptyLegacyPayload(bob);

    lobby.handleScore(CABINET_A, parsed(emptyLegacyPayload(bob)));
    lobby.handleFinalScore(CABINET_A, parsed(aliceFinal), aliceFinal);
    jest.advanceTimersByTime(config.finalGraceMs + 1);
    const beforeSkip = published.length;

    lobby.handleFinalScore(CABINET_A, parsed(bobSkip), bobSkip);
    jest.advanceTimersByTime(config.finalGraceMs + 1);

    expect(screens(published.slice(beforeSkip))).toEqual([
      "ScreenGameplay",
      "ScreenEvaluation",
    ]);
    expect(published.at(-1)?.players).toEqual([
      expect.objectContaining({ playerId: "P1", profileName: "Alice" }),
    ]);
  });

  it("completes nothing when the song was skipped on every side", () => {
    const { lobby, published } = lobbyUnderTest();
    const aliceSkip = emptyLegacyPayload(alice);
    const bobSkip = emptyLegacyPayload(bob);

    lobby.handleSong(CABINET_A, "5guys1pack/Earthquake");
    const selected = published.length;

    lobby.handleFinalScore(CABINET_A, parsed(aliceSkip), aliceSkip);
    lobby.handleFinalScore(CABINET_A, parsed(bobSkip), bobSkip);
    jest.advanceTimersByTime(config.finalTimeoutMs + 1);

    expect(published).toHaveLength(selected);
  });

  it("ignores a repeated final datagram", () => {
    const { lobby, published } = lobbyUnderTest();
    const payload = legacyPayload(alice);

    lobby.handleFinalScore(CABINET_A, parsed(payload), payload);
    jest.advanceTimersByTime(config.finalGraceMs + 1);
    const completed = published.length;

    lobby.handleFinalScore(CABINET_A, parsed(payload), payload);
    jest.advanceTimersByTime(config.finalTimeoutMs + 1);

    expect(published).toHaveLength(completed);
  });

  it("starts a new session when the cabinet moves to another song", () => {
    const { lobby, published } = lobbyUnderTest();

    lobby.handleScore(CABINET_A, parsed(legacyPayload(alice)));
    lobby.handleScore(CABINET_A, parsed(legacyPayload(bob)));
    lobby.handleSong(CABINET_A, "otherpack/Another");

    expect(published.at(-1)).toMatchObject({
      players: [],
      songInfo: expect.objectContaining({ songPath: "otherpack/Another" }),
    });
  });

  it("does not carry a finished song's players into the next play of the same song", () => {
    const { lobby, published } = lobbyUnderTest();
    const first = legacyPayload({ ...alice, formattedScore: "95.45" });
    const second = legacyPayload({ ...alice, formattedScore: "97.00" });

    lobby.handleFinalScore(CABINET_A, parsed(first), first);
    jest.advanceTimersByTime(config.finalGraceMs + 1);
    lobby.handleFinalScore(CABINET_A, parsed(second), second);
    jest.advanceTimersByTime(config.finalGraceMs + 1);

    expect(screens(published)).toEqual([
      "ScreenGameplay",
      "ScreenEvaluation",
      "ScreenGameplay",
      "ScreenEvaluation",
    ]);
    expect(published.at(-1)?.players[0]).toMatchObject({ exScore: 97 });
  });

  describe("with a room of cabinets", () => {
    const carol: LegacyPayloadOverrides = {
      playerNumber: 0,
      playerName: "Carol",
      formattedScore: "88.10",
    };
    const dave: LegacyPayloadOverrides = {
      playerNumber: 0,
      playerName: "Dave",
      formattedScore: "91.00",
    };

    it("keeps every cabinet's P1 apart, addressed by where it came from", () => {
      const { lobby, published } = lobbyUnderTest();

      lobby.handleScore(CABINET_A, parsed(legacyPayload(alice)));
      lobby.handleScore(CABINET_B, parsed(legacyPayload(carol)));
      lobby.handleScore(CABINET_C, parsed(legacyPayload(dave)));

      expect(published.at(-1)?.players).toEqual([
        expect.objectContaining({
          playerId: "P1",
          profileName: "Alice",
          exScore: 95.45,
        }),
        expect.objectContaining({
          playerId: "P1",
          profileName: "Carol",
          exScore: 88.1,
        }),
        expect.objectContaining({
          playerId: "P1",
          profileName: "Dave",
          exScore: 91,
        }),
      ]);
    });

    it("does not let a cabinet's score overwrite another cabinet's", () => {
      const { lobby, published } = lobbyUnderTest();

      lobby.handleScore(CABINET_A, parsed(legacyPayload(alice)));
      lobby.handleScore(CABINET_B, parsed(legacyPayload(carol)));
      lobby.handleScore(
        CABINET_A,
        parsed(legacyPayload({ ...alice, formattedScore: "96.00" })),
      );

      expect(published.at(-1)?.players).toEqual([
        expect.objectContaining({ profileName: "Alice", exScore: 96 }),
        expect.objectContaining({ profileName: "Carol", exScore: 88.1 }),
      ]);
    });

    it("completes the song once, when the last cabinet has finished", () => {
      const { lobby, published } = lobbyUnderTest();
      const aliceFinal = legacyPayload({ ...alice, formattedScore: "96.00" });
      const carolFinal = legacyPayload({ ...carol, formattedScore: "89.00" });
      const daveFinal = legacyPayload({ ...dave, formattedScore: "92.00" });

      lobby.handleScore(CABINET_A, parsed(legacyPayload(alice)));
      lobby.handleScore(CABINET_B, parsed(legacyPayload(carol)));
      lobby.handleScore(CABINET_C, parsed(legacyPayload(dave)));
      const beforeCompletion = published.length;

      lobby.handleFinalScore(CABINET_A, parsed(aliceFinal), aliceFinal);
      lobby.handleFinalScore(CABINET_B, parsed(carolFinal), carolFinal);
      jest.advanceTimersByTime(config.finalGraceMs + 1);
      expect(published).toHaveLength(beforeCompletion);

      lobby.handleFinalScore(CABINET_C, parsed(daveFinal), daveFinal);
      jest.advanceTimersByTime(config.finalGraceMs + 1);

      expect(screens(published.slice(beforeCompletion))).toEqual([
        "ScreenGameplay",
        "ScreenEvaluation",
      ]);
      expect(names(published.at(-1))).toEqual(["Alice", "Carol", "Dave"]);
      expect(published.at(-1)?.players).toEqual([
        expect.objectContaining({ profileName: "Alice", exScore: 96 }),
        expect.objectContaining({ profileName: "Carol", exScore: 89 }),
        expect.objectContaining({ profileName: "Dave", exScore: 92 }),
      ]);
    });

    it("leaves a cabinet on another song out without clearing the others", () => {
      const { lobby, published } = lobbyUnderTest();

      lobby.handleScore(CABINET_A, parsed(legacyPayload(alice)));
      lobby.handleScore(CABINET_B, parsed(legacyPayload(carol)));
      lobby.handleSong(CABINET_C, "otherpack/Another");

      expect(published.at(-1)).toMatchObject({
        songInfo: expect.objectContaining({
          songPath: "5guys1pack/Earthquake",
        }),
      });
      expect(names(published.at(-1))).toEqual(["Alice", "Carol"]);
    });

    it("moves the lobby on once every cabinet has left the song", () => {
      const { lobby, published } = lobbyUnderTest();

      lobby.handleScore(CABINET_A, parsed(legacyPayload(alice)));
      lobby.handleScore(CABINET_B, parsed(legacyPayload(carol)));
      lobby.handleSong(CABINET_A, "otherpack/Another");
      lobby.handleSong(CABINET_B, "otherpack/Another");

      expect(published.at(-1)).toMatchObject({
        players: [],
        songInfo: expect.objectContaining({ songPath: "otherpack/Another" }),
      });
    });

    it("refuses the cabinet past the fourth, as the real server does", () => {
      const { lobby, published } = lobbyUnderTest();
      const addresses = ["10.0.0.1", "10.0.0.2", "10.0.0.3", "10.0.0.4"];

      addresses.forEach((address, index) =>
        lobby.handleScore(
          address,
          parsed(legacyPayload({ ...alice, playerName: `Player${index}` })),
        ),
      );
      lobby.handleScore(
        "10.0.0.5",
        parsed(legacyPayload({ ...alice, playerName: "TooMany" })),
      );

      expect(published.at(-1)?.players).toHaveLength(MAX_MACHINES);
      expect(names(published.at(-1))).not.toContain("TooMany");
    });

    it("drops a cabinet that has gone quiet and stops waiting for it", () => {
      // Short enough that the cabinet is dropped well before the song would
      // have timed out, which is what makes this the eviction being tested.
      const machineIdleMs = 5000;
      const { lobby, published } = lobbyUnderTest({ machineIdleMs });
      const aliceFinal = legacyPayload(alice);

      lobby.handleScore(CABINET_A, parsed(aliceFinal));
      lobby.handleScore(CABINET_B, parsed(legacyPayload(carol)));
      lobby.handleFinalScore(CABINET_A, parsed(aliceFinal), aliceFinal);

      // Cabinet B is unplugged mid-song: it never sends its final score.
      jest.advanceTimersByTime(machineIdleMs + config.finalGraceMs + 2);

      expect(names(published.at(-1))).toEqual(["Alice"]);
      expect(screens(published).slice(-2)).toEqual([
        "ScreenGameplay",
        "ScreenEvaluation",
      ]);
      lobby.close();
    });

    it("takes a dropped cabinet back on its next datagram", () => {
      const machineIdleMs = 5000;
      const { lobby, published } = lobbyUnderTest({ machineIdleMs });

      lobby.handleScore(CABINET_A, parsed(legacyPayload(alice)));
      jest.advanceTimersByTime(machineIdleMs + 1);
      expect(published.at(-1)?.players).toEqual([]);

      // Legacy counters are cumulative, so the packet that registers the
      // cabinet again also carries the whole run back.
      lobby.handleScore(
        CABINET_A,
        parsed(legacyPayload({ ...alice, formattedScore: "96.00" })),
      );

      expect(published.at(-1)?.players).toEqual([
        expect.objectContaining({
          playerId: "P1",
          profileName: "Alice",
          exScore: 96,
          ready: true,
        }),
      ]);
      expect(published.at(-1)).toMatchObject({
        songInfo: expect.objectContaining({
          songPath: "5guys1pack/Earthquake",
        }),
      });
      lobby.close();
    });

    it("does not report a completed song again when its cabinets are dropped", () => {
      const machineIdleMs = 5000;
      const { lobby, published } = lobbyUnderTest({ machineIdleMs });
      const aliceFinal = legacyPayload(alice);
      const carolFinal = legacyPayload(carol);

      lobby.handleFinalScore(CABINET_A, parsed(aliceFinal), aliceFinal);
      lobby.handleFinalScore(CABINET_B, parsed(carolFinal), carolFinal);
      jest.advanceTimersByTime(config.finalGraceMs + 1);

      expect(names(published.at(-1))).toEqual(["Alice", "Carol"]);
      const completed = published.length;

      // Both cabinets go quiet once the song is over, which is the ordinary
      // end of a song and not a second, smaller result for it.
      jest.advanceTimersByTime(machineIdleMs * 2 + 1);

      expect(published).toHaveLength(completed);
      lobby.close();
    });
  });
});
