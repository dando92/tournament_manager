import { Entrant } from "@/features/entrant/types/Entrant";
import { PhaseGroup } from "@/features/division/model/types";

/**
 * What the tournament feature reads and what it shapes for itself.
 *
 * The responses come from `@tournament-manager/contracts` and are only renamed
 * here, so removing a field from the API breaks this workspace at compile
 * time. What is declared rather than imported is a view type: something the
 * interface needs and no endpoint returns.
 */

export type {
  TournamentDto as Tournament,
  TournamentConfigurationDto as TournamentConfiguration,
  TournamentOverviewDto as TournamentOverview,
  StartggImportPreviewResponseDto as StartggImportPreviewResponse,
  StartggImportResponseDto as StartggImportResponse,
} from "@tournament-manager/contracts";

export type StartggImportMode = "create-division";

export type StartggImportPreviewRequest = {
  eventSlug: string;
  targetTournamentId?: number;
  mode?: StartggImportMode;
};

/**
 * A division as the tree draws it: its phases and pools flattened to what a
 * node needs, with the entrants the overview already carried.
 */
export interface TournamentDivisionOptionPhase {
  id: number;
  name: string;
  matchCount: number;
  phaseGroups?: PhaseGroup[];
}

export interface TournamentDivisionOption {
  id: number;
  name: string;
  entrants: Entrant[];
  phases: TournamentDivisionOptionPhase[];
}

/**
 * The tournament graph as `GET /divisions?tournamentId=` still sends it: raw
 * entities, divisions through scores, four levels deep.
 *
 * It is declared here and not in `@tournament-manager/contracts` because it is
 * not a projection anybody chose — it is whatever the entity relations happen
 * to carry. Phase 5 of the API refactoring replaces the endpoint with a
 * standings query and this type goes with it. Until then the statistics page
 * is the only consumer, and this states exactly the fields it reads.
 */

export type TournamentStatsScore = {
  percentage: number;
  isFailed: boolean;
};

export type TournamentStatsStanding = {
  id: number;
  points: number;
  player: { id: number; playerName: string };
  score: TournamentStatsScore | null;
};

export type TournamentStatsRound = {
  id: number;
  song: { title: string; artist?: string } | null;
  standings?: TournamentStatsStanding[];
};

export type TournamentStatsMatch = {
  id: number;
  name: string;
  rounds?: TournamentStatsRound[];
};

export type TournamentStatsPhase = {
  name: string;
  matches?: TournamentStatsMatch[];
};

export type TournamentStatsDivision = {
  name: string;
  phases?: TournamentStatsPhase[];
};
