export type { SongDto as Song, SongRollSlotDto as SongRollSlot } from "@tournament-manager/contracts";

/** A song as the create form states it, before it has an id. */
export type CreateSongRequest = {
  title: string;
  artist?: string;
  difficulty: number;
  group: string;
};
