import { hasJudgedItem, toJudgments } from "../../src/domain/judgment-mapper";
import {
  isEphemeralScore,
  legacyPercentage,
} from "../../src/domain/score-normalizer";
import {
  parseLegacyScoreMessage,
  type LegacyScoreMessage,
} from "../../src/legacy/score-message";
import {
  emptyLegacyPayload,
  legacyPayload,
  type LegacyPayloadOverrides,
} from "./legacy-payload";

function message(overrides: LegacyPayloadOverrides = {}): LegacyScoreMessage {
  const parsed = parseLegacyScoreMessage(legacyPayload(overrides));
  if (!parsed) throw new Error("fixture payload must parse");
  return parsed;
}

describe("legacyPercentage", () => {
  it("keeps the percentage the cabinet displayed", () => {
    expect(legacyPercentage(message({ formattedScore: "95.45" }))).toBe(95.45);
    expect(legacyPercentage(message({ formattedScore: "99.12%" }))).toBe(99.12);
  });

  it("falls back to the dance points when no percentage was sent", () => {
    const score = message({
      formattedScore: "",
      actualDancePoints: 50,
      possibleDancePoints: 200,
    });

    expect(legacyPercentage(score)).toBe(25);
  });

  it("answers zero when there is nothing to divide by", () => {
    expect(
      legacyPercentage(message({ formattedScore: "", possibleDancePoints: 0 })),
    ).toBe(0);
  });
});

describe("toJudgments", () => {
  it("separates the two fantastic windows the cabinet sends apart", () => {
    const judgments = toJudgments(
      message({ white: 120, fantasticsWithoutWhite: 44 }),
    );

    expect(judgments.fantasticPlus).toBe(120);
    expect(judgments.fantastics).toBe(44);
  });

  it("maps the remaining windows onto the judgment model", () => {
    const judgments = toJudgments(message());

    expect(judgments).toMatchObject({
      excellents: 20,
      greats: 9,
      decents: 4,
      wayOffs: 1,
      misses: 2,
      minesHit: 0,
      totalMines: 3,
      holdsHeld: 7,
      totalHolds: 9,
      rollsHeld: 0,
      totalRolls: 0,
    });
  });

  it("counts steps from judged arrows and not from mines or holds", () => {
    expect(toJudgments(message()).totalSteps).toBe(
      120 + 44 + 20 + 9 + 4 + 1 + 2,
    );
  });
});

describe("hasJudgedItem", () => {
  it("is false for the update a cabinet sends before the first arrow", () => {
    const parsed = parseLegacyScoreMessage(emptyLegacyPayload());
    if (!parsed) throw new Error("fixture payload must parse");

    expect(hasJudgedItem(toJudgments(parsed), parsed)).toBe(false);
  });

  it("is true once anything has been judged", () => {
    const stepped = message();
    const mined = message({
      white: 0,
      fantasticsWithoutWhite: 0,
      w2: 0,
      w3: 0,
      w4: 0,
      w5: 0,
      miss: 0,
      hitMine: 1,
      held: 0,
      letGo: 0,
      missed: 0,
    });

    expect(hasJudgedItem(toJudgments(stepped), stepped)).toBe(true);
    expect(hasJudgedItem(toJudgments(mined), mined)).toBe(true);
  });
});

describe("isEphemeralScore", () => {
  it("is true for the final score of a song that was skipped", () => {
    const skipped = parseLegacyScoreMessage(emptyLegacyPayload());
    if (!skipped) throw new Error("fixture payload must parse");

    expect(isEphemeralScore(skipped)).toBe(true);
  });

  it("is false for a run that was judged, however low it scored", () => {
    const missed = message({
      formattedScore: "0.00",
      actualDancePoints: 0,
      white: 0,
      fantasticsWithoutWhite: 0,
      w2: 0,
      w3: 0,
      w4: 0,
      w5: 0,
      miss: 40,
      avoidMine: 0,
      letGo: 0,
      held: 0,
    });

    expect(isEphemeralScore(missed)).toBe(false);
    expect(isEphemeralScore(message())).toBe(false);
  });
});
