import { Standing } from "@/features/match/types/Standing";
import { Song } from "@/features/song/types/Song";

export interface Round {
  id: number;
  standings: Standing[];
  song: Song;
}
