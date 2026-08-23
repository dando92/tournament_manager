import axios from "axios";
import { Match, Score, CommitMatchResultResponse, CreateMatchRequest, RoundSourceRequest } from "@/features/match/model/types";

/**
 * Every request the matches of a division answer.
 *
 * The reads project a match; the writes answer `204` and say nothing, because
 * what they changed arrives over the realtime channel. The two exceptions carry
 * what no event can: a creation says where the new match is, and a commit says
 * what start.gg made of the result.
 */

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

export async function create(request: CreateMatchRequest): Promise<number> {
  try {
    const response = await axios.post<{ id: number }>("matches", {
      name: request.name,
      subtitle: request.subtitle,
      notes: request.notes,
      entrantIds: request.entrantIds,
      scoringSystem: request.scoringSystem,
      phaseGroupId: request.phaseGroupId,
      group: request.group,
      levels: request.levels,
      songIds: request.songIds,
    });
    return response.data.id;
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

export async function editMatchNotes(matchId: number, notes: string): Promise<void> {
  try {
    await axios.patch(`matches/${matchId}`, { notes });
  } catch (error) {
    console.error("Error editing match notes:", error);
    throw new Error("Unable to edit match notes.");
  }
}

export async function renameMatch(matchId: number, name: string): Promise<void> {
  try {
    await axios.patch(`matches/${matchId}`, { name });
  } catch (error) {
    console.error("Error renaming match:", error);
    throw new Error("Unable to rename match.");
  }
}

export async function updateMatchScoringSystem(matchId: number, scoringSystem: string): Promise<void> {
  try {
    await axios.patch(`matches/${matchId}`, { scoringSystem });
  } catch (error) {
    console.error("Error updating match scoring system:", error);
    throw new Error("Unable to update the match scoring system.");
  }
}

export async function updateMatchEntrants(matchId: number, entrantIds: number[]): Promise<void> {
  try {
    await axios.patch(`matches/${matchId}`, { entrantIds });
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
export async function addRound(matchId: number, source: RoundSourceRequest = {}): Promise<void> {
  try {
    await axios.post(`matches/${matchId}/rounds`, source);
  } catch (error) {
    console.error("Error adding round to match:", error);
    throw new Error("Unable to add a round to the match.");
  }
}

export async function deleteRound(roundId: number): Promise<void> {
  try {
    await axios.delete(`rounds/${roundId}`);
  } catch (error) {
    console.error("Error deleting round:", error);
    throw new Error("Unable to delete the round.");
  }
}

export async function replaceRoundSong(roundId: number, source: RoundSourceRequest): Promise<void> {
  try {
    await axios.put(`rounds/${roundId}`, source);
  } catch (error) {
    console.error("Error replacing the song of a round:", error);
    throw new Error("Unable to replace the song of the round.");
  }
}

export async function upsertScore(
  roundId: number,
  playerId: number,
  score: { percentage: number; isFailed: boolean; scoreId?: number },
): Promise<void> {
  try {
    await axios.put(`rounds/${roundId}/scores/${playerId}`, score);
  } catch (error) {
    console.error("Error saving a score:", error);
    throw new Error("Unable to save the score.");
  }
}

export async function upsertPoints(roundId: number, playerId: number, points: number): Promise<void> {
  try {
    await axios.put(`rounds/${roundId}/points/${playerId}`, { points });
  } catch (error) {
    console.error("Error saving points:", error);
    throw new Error("Unable to save the points.");
  }
}

export async function deleteStanding(roundId: number, playerId: number): Promise<void> {
  try {
    await axios.delete(`rounds/${roundId}/standings/${playerId}`);
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

export async function updateMatchActive(matchId: number, active: boolean): Promise<void> {
  try {
    await axios.put(`matches/${matchId}/active`, { active });
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

export async function reopenMatchResult(matchId: number): Promise<void> {
  try {
    await axios.delete(`matches/${matchId}/result`);
  } catch (error) {
    console.error("Error re-opening match result:", error);
    throw new Error("Unable to re-open match result.");
  }
}

export async function listScoringSystems(): Promise<string[]> {
  const response = await axios.get<string[]>("matches/scoring-systems");
  return response.data;
}
