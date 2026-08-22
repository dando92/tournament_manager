import { Standing } from "@/features/match/types/Standing";
import { Song } from "@/features/song/types/Song";

/**
 * One unit a match is scored in.
 *
 * A round with a song is a song that was played. A round without one is the
 * hand-scored round: its standings carry points somebody wrote. A match holds
 * at most one of those.
 */
export interface Round {
  id: number;
  standings: Standing[];
  song: Song | null;
}

export function isHandScored(round: Round): boolean {
  return round.song === null;
}
