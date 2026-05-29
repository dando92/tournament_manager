import axios from "axios";
import { Match, MatchState } from "@/features/match/types/Match";
import {
  AddStandingToMatchRequest,
  CreateMatchRequest,
} from "@/features/match/types/match-requests";

export async function listByDivision(divisionId: number): Promise<Match[]> {
  try {
    const response = await axios.get<Match[]>(`matches/division/${divisionId}`);
    return response.data;
  } catch (error) {
    console.error("Error listing matches by division:", error);
    throw new Error("Unable to list matches by division.");
  }
}

export async function create(request: CreateMatchRequest): Promise<Match> {
  try {
    const response = await axios.post<Match>("matches", {
      name: request.name,
      subtitle: request.subtitle,
      notes: request.notes,
      entrantIds: request.entrantIds,
      scoringSystem: request.scoringSystem,
      phaseId: request.phaseId,
      divisionId: request.divisionId,
      group: request.group,
      levels: request.levels,
      songIds: request.songIds,
    });
    return response.data;
  } catch (error) {
    console.error("Error creating match:", error);
    throw new Error("Unable to create match.");
  }
}

export async function getMatch(matchId: number): Promise<Match> {
  try {
    const response = await axios.get<Match>(`matches/${matchId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching match:", error);
    throw new Error("Unable to fetch match.");
  }
}

export async function editMatchNotes(
  matchId: number,
  notes: string,
): Promise<string> {
  try {
    const response = await axios.patch<Match>(`matches/${matchId}`, { notes });
    return response.data.notes;
  } catch (error) {
    console.error("Error editing match notes:", error);
    throw new Error("Unable to edit match notes.");
  }
}

export async function renameMatch(
  matchId: number,
  name: string,
): Promise<string> {
  try {
    const response = await axios.patch<Match>(`matches/${matchId}`, { name });
    return response.data.name;
  } catch (error) {
    console.error("Error renaming match:", error);
    throw new Error("Unable to rename match.");
  }
}

export async function updateMatchEntrants(
  matchId: number,
  entrantIds: number[],
): Promise<Match> {
  try {
    const response = await axios.patch<Match>(`matches/${matchId}`, { entrantIds });
    return response.data;
  } catch (error) {
    console.error("Error updating match entrants:", error);
    throw new Error("Unable to update match entrants.");
  }
}

export async function deleteMatch(matchId: number): Promise<void> {
  try {
    await axios.delete("matches/" + matchId);
  } catch (error) {
    console.error("Error deleting match:", error);
    throw new Error("Unable to delete match.");
  }
}

export async function deleteSongFromMatch(
  matchId: number,
  songId: number,
): Promise<Match> {
  try {
    const response = await axios.delete<Match>(
      `matches/${matchId}/songs/${songId}`,
    );
    return response.data;
  } catch (error) {
    console.error("Error deleting song from match:", error);
    throw new Error("Unable to delete song from match.");
  }
}

export async function addSongToMatch(
  matchId: number,
  songId?: number,
  divisionId?: number,
  group?: string,
  level?: string,
): Promise<Match> {
  try {
    const response = await axios.post<Match>(
      `matches/${matchId}/songs`,
      { songId, divisionId, group, level },
    );
    return response.data;
  } catch (error) {
    console.error("Error adding song to match:", error);
    throw new Error("Unable to add song to match.");
  }
}

export async function editSongInMatch(
  matchId: number,
  editSongId: number,
  songId?: number,
  divisionId?: number,
  group?: string,
  level?: string,
): Promise<Match> {
  try {
    const response = await axios.put<Match>(
      `matches/${matchId}/songs/${editSongId}`,
      { songId, divisionId, group, level },
    );
    return response.data;
  } catch (error) {
    console.error("Error editing song in match:", error);
    throw new Error("Unable to edit song in match.");
  }
}

export async function addStandingToMatch(
  matchId: number,
  request: AddStandingToMatchRequest,
): Promise<Match> {
  try {
    const response = await axios.post<Match>(
      `standings/matches/${matchId}`,
      request,
    );
    return response.data;
  } catch (error) {
    console.error("Error adding standing to match:", error);
    throw new Error("Unable to add standing to match.");
  }
}

export async function editStandingInMatch(
  matchId: number,
  songId: number,
  playerId: number,
  percentage: number,
  score: number,
  isFailed: boolean,
): Promise<Match> {
  try {
    const response = await axios.put<Match>(
      `standings/matches/${matchId}`,
      { songId, playerId, percentage, score, isFailed },
    );
    return response.data;
  } catch (error) {
    console.error("Error editing standing in match:", error);
    throw new Error("Unable to edit standing in match.");
  }
}

export async function updateMatchPaths(
  matchId: number,
  targetPaths: number[],
): Promise<Match> {
  try {
    const response = await axios.put<Match>(
      `matches/${matchId}/paths`,
      { targetPaths },
    );
    return response.data;
  } catch (error) {
    console.error("Error updating match paths:", error);
    throw new Error("Unable to update match paths.");
  }
}

export async function updateMatchState(matchId: number, state: MatchState): Promise<Match> {
  try {
    const response = await axios.put<Match>(`matches/${matchId}/state`, { state });
    return response.data;
  } catch (error) {
    console.error("Error updating match state:", error);
    throw new Error("Unable to update match state.");
  }
}

export async function deleteStandingFromMatch(
  matchId: number,
  playerId: number,
  songId: number,
): Promise<Match> {
  try {
    const response = await axios.delete<Match>(
      `standings/matches/${matchId}/${playerId}/${songId}`,
    );
    return response.data;
  } catch (error) {
    console.error("Error deleting standing from match:", error);
    throw new Error("Unable to delete standing from match.");
  }
}
