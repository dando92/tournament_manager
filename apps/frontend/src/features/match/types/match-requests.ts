import { Match } from "@/features/match/types/Match";

export interface CreateMatchRequest {
  phaseGroupId: number;
  divisionId?: number; // only needed for song rolling
  name: string;
  subtitle: string;
  scoringSystem: string;
  notes: string;
  group: string;
  levels: string;
  songIds: number[];
  entrantIds: number[];
}

export interface AddSongToMatchRequest {
  matchId: number;
  group?: string;
  level?: string;
  songId?: number;
  divisionId?: number;
}

export interface EditSongToMatchRequest {
  matchId: number;
  songId: number;
  group?: string;
  level?: string;
  newSongId?: number;
  divisionId?: number;
}

export interface AddStandingToMatchRequest {
  scoreId?: number;
  playerId: number;
  songId: number;
  percentage: number;
  score: number;
  isFailed: boolean;
}

export interface MatchPlayerPointsRequest {
  playerId: number;
  points: number;
}

export interface CommitMatchResultRequest {
  playerPoints?: MatchPlayerPointsRequest[];
}

/** `skipped` means the match is not linked to a start.gg set, so there was nothing to report. */
export type StartggReportStatus = "reported" | "skipped" | "failed";

export interface CommitMatchResultResponse {
  match: Match;
  startggReport: StartggReportStatus;
}
