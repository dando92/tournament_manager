import type { MatchRoundDto } from "@tournament-manager/contracts";

/**
 * One unit a match is scored in.
 *
 * A round with a song is a song that was played. A round without one is the
 * hand-scored round: its standings carry points somebody wrote. A match holds
 * at most one of those.
 */
export type { MatchRoundDto as Round };

export function isHandScored(round: MatchRoundDto): boolean {
  return round.song === null;
}
