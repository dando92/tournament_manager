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
  TournamentRefDto as TournamentRef,
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
 * node needs. The roster is not among them — the tree shows names of divisions,
 * phases and pools, and the pages that show people ask for them separately.
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
  phases: TournamentDivisionOptionPhase[];
}

