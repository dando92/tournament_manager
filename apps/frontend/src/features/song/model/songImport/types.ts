import type { ChartDifficulty, SongImportRowDto } from "@tournament-manager/contracts";

/**
 * What the ITGmania importer reads, before any of it is a song of a pool.
 *
 * These shapes are the ones the old `itgmania-songs-to-json.mjs` script worked
 * in. The script walked a folder with `node:fs`; the browser walks the folder
 * the person granted it, which is the only part that changed.
 */

/** Which charts of a song are imported. `highest` means the highest meter. */
export type ChartMode = "all" | "highest";

/** One chart of a simfile: what it is written for, how hard it is, and its slot. */
export type ParsedChart = {
  stepstype: string;
  meter: number;
  difficulty: ChartDifficulty | null;
};

/** One simfile, read. */
export type ParsedSimfile = {
  artist: string;
  charts: ParsedChart[];
};

/** A song folder that held a simfile, and everything the import takes from it. */
export type ScannedSong = {
  pack: string;
  folder: string;
  /** SyncStart's song path: `Pack/SongFolder`, with no `Songs/` prefix. */
  songPath: string;
  artist: string;
  charts: ParsedChart[];
};

/**
 * What one directory turned out to hold.
 *
 * The scan is done once, before the person confirms, and this is what the
 * confirmation summarises and the import is built from. Choosing `all` or
 * `highest` afterwards filters this; it does not read the disk again.
 */
export type ScanResult = {
  rootName: string;
  packs: string[];
  songs: ScannedSong[];
  /** Song folders the scan could not read or make sense of, named. */
  warnings: string[];
};

/** One row of the payload the API is asked to persist. */
export type ImportRow = SongImportRowDto;

/** The rows an import will send, and the charts left out of it. */
export type ImportSelection = {
  rows: ImportRow[];
  warnings: string[];
};
