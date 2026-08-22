export type {
  CommitMatchResultResponseDto as CommitMatchResultResponse,
  StartggReportStatus,
} from "@tournament-manager/contracts";

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

/**
 * Where a round's song comes from. Empty means no song at all, which is the
 * hand-scored round.
 */
export interface RoundSourceRequest {
  songId?: number;
  divisionId?: number;
  group?: string;
  level?: string;
}
