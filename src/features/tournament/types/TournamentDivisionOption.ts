import { Entrant } from "@/features/entrant/types/Entrant";
import { PhaseGroup } from "@/features/division/types/Phase";

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
