import axios from "axios";
import { Match } from "@/features/match/types/Match";
import { Score } from "@/features/match/types/Standing";
import {
  CommitMatchResultResponse,
  CreateMatchRequest,
  RoundSourceRequest,
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

export async function listByPhaseGroup(phaseGroupId: number): Promise<Match[]> {
  try {
    const response = await axios.get<Match[]>(`matches/phase-group/${phaseGroupId}`);
    return response.data;
  } catch (error) {
    console.error("Error listing matches by pool:", error);
    throw new Error("Unable to list matches by pool.");
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
      phaseGroupId: request.phaseGroupId,
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

/**
 * Adds one round to a match: a chosen song, a rolled one, or — with nothing at
 * all — the hand-scored round, whose points are written by a person.
 */
export async function addRound(matchId: number, source: RoundSourceRequest = {}): Promise<Match> {
  try {
    const response = await axios.post<Match>(`matches/${matchId}/rounds`, source);
    return response.data;
  } catch (error) {
    console.error("Error adding round to match:", error);
    throw new Error("Unable to add a round to the match.");
  }
}

export async function deleteRound(roundId: number): Promise<Match> {
  try {
    const response = await axios.delete<Match>(`rounds/${roundId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting round:", error);
    throw new Error("Unable to delete the round.");
  }
}

export async function replaceRoundSong(roundId: number, source: RoundSourceRequest): Promise<Match> {
  try {
    const response = await axios.put<Match>(`rounds/${roundId}`, source);
    return response.data;
  } catch (error) {
    console.error("Error replacing the song of a round:", error);
    throw new Error("Unable to replace the song of the round.");
  }
}

export async function upsertScore(
  roundId: number,
  playerId: number,
  score: { percentage: number; isFailed: boolean; scoreId?: number },
): Promise<Match> {
  try {
    const response = await axios.put<Match>(`rounds/${roundId}/scores/${playerId}`, score);
    return response.data;
  } catch (error) {
    console.error("Error saving a score:", error);
    throw new Error("Unable to save the score.");
  }
}

export async function upsertPoints(roundId: number, playerId: number, points: number): Promise<Match> {
  try {
    const response = await axios.put<Match>(`rounds/${roundId}/points/${playerId}`, { points });
    return response.data;
  } catch (error) {
    console.error("Error saving points:", error);
    throw new Error("Unable to save the points.");
  }
}

export async function deleteStanding(roundId: number, playerId: number): Promise<Match> {
  try {
    const response = await axios.delete<Match>(`rounds/${roundId}/standings/${playerId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting a standing:", error);
    throw new Error("Unable to delete the standing.");
  }
}

export async function listScores(songId: number, playerId: number): Promise<Score[]> {
  try {
    const response = await axios.get<Score[]>("scores", {
      params: { songId, playerId },
    });
    return response.data;
  } catch (error) {
    console.error("Error listing scores:", error);
    throw new Error("Unable to list scores.");
  }
}

export async function updateMatchActive(matchId: number, active: boolean): Promise<Match> {
  try {
    const response = await axios.put<Match>(`matches/${matchId}/active`, { active });
    return response.data;
  } catch (error) {
    console.error("Error updating match active state:", error);
    throw new Error("Unable to update match active state.");
  }
}

export async function commitMatchResult(matchId: number): Promise<CommitMatchResultResponse> {
  try {
    const response = await axios.put<CommitMatchResultResponse>(`matches/${matchId}/result`, {});
    return response.data;
  } catch (error) {
    console.error("Error committing match result:", error);
    throw new Error("Unable to commit match result.");
  }
}

export async function reopenMatchResult(matchId: number): Promise<Match> {
  try {
    const response = await axios.delete<Match>(`matches/${matchId}/result`);
    return response.data;
  } catch (error) {
    console.error("Error re-opening match result:", error);
    throw new Error("Unable to re-open match result.");
  }
}
