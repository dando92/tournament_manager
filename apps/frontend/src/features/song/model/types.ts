export type { SongDto as Song } from "@tournament-manager/contracts";

/** A song as the create form and the bulk import state it, before it has an id. */
export type CreateSongRequest = {
  title: string;
  artist?: string;
  difficulty: number;
  group: string;
};
