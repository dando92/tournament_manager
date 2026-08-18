import { Player } from '@/features/player/types/Player'
import { Song } from '@/features/song/types/Song'

export interface Score {
  id: number;
  percentage: number;
  isFailed: boolean;
  player: Player;
  song: Song;
}

export interface Standing {
  id: number;
  score: Score;
  points: number;
}
