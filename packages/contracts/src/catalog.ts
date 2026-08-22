import type { PlayerRefDto, SongRefDto } from './projections';

/** A song of a tournament's pool, as the song list and the roller describe it. */
export type SongDto = SongRefDto & {
    artist?: string;
    difficulty: number;
    group: string;
};

/** A score on its own, outside the match that produced it. */
export type ScoreDto = {
    id: number;
    percentage: number;
    isFailed: boolean;
    player: PlayerRefDto;
    song: SongDto;
};
