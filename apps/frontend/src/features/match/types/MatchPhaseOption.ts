import { PhaseGroup } from "@/features/division/types/Phase";

export interface MatchPhaseOption {
  id: number;
  name: string;
  phaseGroups?: PhaseGroup[];
}
