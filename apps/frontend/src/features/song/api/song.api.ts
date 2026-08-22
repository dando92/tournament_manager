import axios from "axios";
import { CreateSongRequest, Song } from "@/features/song/types/Song";

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

/**
 * Adds one song to a tournament's pool.
 *
 * The bulk import calls this once per row of its file. There is no batch route,
 * so the loop is the caller's and each row succeeds or fails on its own, which
 * is what lets the import report how many of each.
 */
export async function createSong(tournamentId: number, request: CreateSongRequest): Promise<Song> {
  const response = await axios.post<Song>("songs", { ...request, tournamentId });
  return response.data;
}

export async function deleteSong(songId: number): Promise<void> {
  await axios.delete(`songs/${songId}`);
}
