import {
  LEGACY_SCORE_FIELD_COUNT,
  parseLegacyScoreMessage,
} from "../../src/legacy/score-message";
import { legacyPayload } from "./legacy-payload";

describe("parseLegacyScoreMessage", () => {
  it("reads every field of a cabinet score message", () => {
    const message = parseLegacyScoreMessage(legacyPayload());

    expect(message).toEqual({
      song: "5guys1pack/Earthquake",
      playerNumber: 0,
      playerName: "Alice",
      actualDancePoints: 4200,
      currentPossibleDancePoints: 4400,
      possibleDancePoints: 4400,
      formattedScore: "95.45",
      life: 1,
      isFailed: false,
      taps: {
        none: 0,
        hitMine: 0,
        avoidMine: 3,
        checkpointMiss: 0,
        miss: 2,
        w5: 1,
        w4: 4,
        w3: 9,
        w2: 20,
        white: 120,
        fantasticsWithoutWhite: 44,
        checkpointHit: 0,
      },
      holds: { none: 0, letGo: 1, held: 7, missed: 0 },
      totalHolds: 9,
    });
  });

  it("names the two sides the way the cabinet numbers them", () => {
    expect(
      parseLegacyScoreMessage(legacyPayload({ playerNumber: 0 }))?.playerNumber,
    ).toBe(0);
    expect(
      parseLegacyScoreMessage(legacyPayload({ playerNumber: 1 }))?.playerNumber,
    ).toBe(1);
    expect(
      parseLegacyScoreMessage(legacyPayload({ playerNumber: 2 })),
    ).toBeNull();
  });

  it("keeps the person and not the team the venue profile names", () => {
    const message = parseLegacyScoreMessage(
      legacyPayload({ playerName: "Alice ~ Team Red" }),
    );

    expect(message?.playerName).toBe("Alice");
  });

  it("reads a failed run", () => {
    expect(
      parseLegacyScoreMessage(legacyPayload({ isFailed: true }))?.isFailed,
    ).toBe(true);
    expect(
      parseLegacyScoreMessage(legacyPayload({ isFailed: false }))?.isFailed,
    ).toBe(false);
  });

  it("drops a truncated message", () => {
    const truncated = legacyPayload().split("|").slice(0, 20).join("|");

    expect(parseLegacyScoreMessage(truncated)).toBeNull();
  });

  it("drops a message with extra fields", () => {
    expect(parseLegacyScoreMessage(`${legacyPayload()}|0`)).toBeNull();
  });

  it("drops a message whose counters are not numbers", () => {
    expect(
      parseLegacyScoreMessage(
        legacyPayload({ w2: "many" as unknown as number }),
      ),
    ).toBeNull();
    expect(
      parseLegacyScoreMessage(
        legacyPayload({ life: "x" as unknown as number }),
      ),
    ).toBeNull();
  });

  it("drops a message that names no song or no player", () => {
    expect(parseLegacyScoreMessage(legacyPayload({ song: "" }))).toBeNull();
    expect(
      parseLegacyScoreMessage(legacyPayload({ playerName: "" })),
    ).toBeNull();
  });

  it("expects the field count the cabinet writes", () => {
    expect(legacyPayload().split("|")).toHaveLength(LEGACY_SCORE_FIELD_COUNT);
  });
});
