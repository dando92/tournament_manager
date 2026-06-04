import { Entrant } from "@/features/entrant/types/Entrant";
import { PhaseGroup } from "@/features/division/types/Phase";

export interface TournamentOverviewPlayer {
  id: number;
  playerName: string;
}

export interface TournamentOverviewPhase {
  id: number;
  name: string;
  matchCount: number;
  phaseGroups?: PhaseGroup[];
}

export interface TournamentOverviewDivision {
  id: number;
  name: string;
  playersPerMatch: number | null;
  entrants: Entrant[];
  phases: TournamentOverviewPhase[];
}

export interface TournamentOverview {
  divisionCount: number;
  playerCount: number;
  matchCount: number;
  divisions: TournamentOverviewDivision[];
}
