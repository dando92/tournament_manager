import type { SongRefDto } from './projections';
import type { ChartDifficulty } from './vocabulary';

/** A song of a tournament's pool, as the song list and the roller describe it. */
export type SongDto = SongRefDto & {
    artist?: string;
    difficulty: number;
    group: string;
    chartDifficulty?: ChartDifficulty | null;
};

/**
 * What one imported chart says about itself.
 *
 * The importer reads a folder of simfiles in the browser, because that is
 * where the person granted access to it, and sends the pool it made of them.
 * The API validates every row of this on the way in: it is the frontend's
 * reading of somebody's disk, not a value the application produced.
 */
export type SongImportRowDto = {
    title: string;
    artist?: string;
    group: string;
    difficulty: number;
    chartDifficulty: ChartDifficulty;
};

/**
 * What became of an import.
 *
 * A chart the pool already holds under the same title, pack and meter is not
 * added twice, and saying so is the difference between "nothing happened" and
 * "you already have these".
 */
export type SongImportResultDto = {
    imported: number;
    skipped: number;
};

/**
 * One slot of a roll: the level that was asked for, and what the pool answered
 * with.
 *
 * A slot with no song is not an error. It says the pool holds nothing of that
 * level the roll may still use, which is what the caller has to see before it
 * decides to lower the level, widen the pack, or allow songs already played.
 */
export type SongRollSlotDto = {
    level: number;
    song: SongDto | null;
};
