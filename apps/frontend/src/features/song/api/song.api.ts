import axios from "axios";
import { Song } from "@/features/song/types/Song";

/**
 * The songs a tournament may draw from, or the whole catalog when no
 * tournament narrows the question.
 *
 * Three callers asked for this list with their own `axios.get`, two of them
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
