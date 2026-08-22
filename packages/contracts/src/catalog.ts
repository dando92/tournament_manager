import type { SongRefDto } from './projections';

/** A song of a tournament's pool, as the song list and the roller describe it. */
export type SongDto = SongRefDto & {
    artist?: string;
    difficulty: number;
    group: string;
};
