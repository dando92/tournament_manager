import { Player } from '@/features/player/types/Player'
import { Song } from '@/features/song/types/Song'

/** A score as the scores endpoint returns it, on its own and fully described. */
export interface Score {
  id: number;
  percentage: number;
  isFailed: boolean;
  player: Player;
  song: Song;
}

/**
 * The evidence carried inside a standing. The player and the song are already
 * known from the standing and its round, so they are not repeated here.
 */
export interface StandingScore {
  id: number;
  percentage: number;
  isFailed: boolean;
}

/**
 * The points of one player in one round.
 *
 * The score is absent on a hand-scored round, where the points were stated by a
 * person rather than played.
 */
export interface Standing {
  id: number;
  player: Player;
  score: StandingScore | null;
  points: number;
}
