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
