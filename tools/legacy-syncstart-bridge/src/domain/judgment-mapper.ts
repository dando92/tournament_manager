import type { LegacyScoreMessage } from "../legacy/score-message";
import type { SyncStartJudgments } from "../syncstart/syncstart.types";

/**
 * The cabinet's counters as the judgment model Tournament Manager draws.
 *
 * Two of these are not exact and are deliberately not presented as if they
 * were. `totalHolds` is the cabinet's `possibleHolds + possibleRolls`, so a
 * chart with rolls reports more total holds than it has; the roll fields stay
 * zero because the legacy payload never separates them (FQ-026). `totalSteps`
 * counts the six judged arrow windows and nothing else — a mine is not a step,
 * and neither is a hold.
 */
export function toJudgments(message: LegacyScoreMessage): SyncStartJudgments {
  const { taps, holds } = message;
  const totalSteps =
    taps.white +
    taps.fantasticsWithoutWhite +
    taps.w2 +
    taps.w3 +
    taps.w4 +
    taps.w5 +
    taps.miss;

  return {
    fantasticPlus: taps.white,
    fantastics: taps.fantasticsWithoutWhite,
    excellents: taps.w2,
    greats: taps.w3,
    decents: taps.w4,
    wayOffs: taps.w5,
    misses: taps.miss,
    totalSteps,
    minesHit: taps.hitMine,
    totalMines: taps.hitMine + taps.avoidMine,
    holdsHeld: holds.held,
    totalHolds: message.totalHolds,
    rollsHeld: 0,
    totalRolls: 0,
  };
}

/**
 * Whether the cabinet has judged anything yet.
 *
 * A score packet arrives before the first arrow as well, with every counter at
 * zero, and a player who has not been judged is not playing yet. Readiness
 * follows the first judged item rather than the first packet.
 */
export function hasJudgedItem(
  judgments: SyncStartJudgments,
  message: LegacyScoreMessage,
): boolean {
  const holds = message.holds.held + message.holds.letGo + message.holds.missed;
  return judgments.totalSteps > 0 || judgments.minesHit > 0 || holds > 0;
}
