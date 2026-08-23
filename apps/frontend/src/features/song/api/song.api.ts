import axios from "axios";
import type { SongImportResultDto } from "@tournament-manager/contracts";
import { CreateSongRequest, Song } from "@/features/song/model/types";
import type { ImportRow } from "@/features/song/model/songImport/types";

/**
 * The songs a tournament may draw from, or the whole catalog when no
 * tournament narrows the question.
 *
 * Four callers asked for this list with their own `axios.get`, two of them
 * inside the match feature. The request is declared once here, where the songs
 * belong, and the callers state what they want rather than how it is addressed.
 */
export async function listSongs(tournamentId?: number): Promise<Song[]> {
  try {
    const response = await axios.get<Song[]>("songs", {
      params: tournamentId !== undefined ? { tournamentId } : undefined,
    });
    return response.data;
  } catch (error) {
    console.error("Error listing songs:", error);
    throw new Error("Unable to list songs.");
  }
}

/** Adds one song to a tournament's pool: what the create form does. */
export async function createSong(tournamentId: number, request: CreateSongRequest): Promise<number> {
  const response = await axios.post<{ id: number }>("songs", { ...request, tournamentId });
  return response.data.id;
}

/**
 * Adds a whole folder of simfiles to a tournament's pool.
 *
 * The import used to be `createSong` in a loop, one request per chart, and a
 * pack could end up half added. It is one request the API writes in one
 * transaction, and it answers with what it wrote and what the pool held
 * already.
 */
export async function importSongs(tournamentId: number, songs: ImportRow[]): Promise<SongImportResultDto> {
  const response = await axios.post<SongImportResultDto>("songs/import", { tournamentId, songs });

  return response.data;
}

export async function deleteSong(songId: number): Promise<void> {
  await axios.delete(`songs/${songId}`);
}
