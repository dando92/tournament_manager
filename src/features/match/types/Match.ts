import { Entrant } from "@/features/entrant/types/Entrant";
import { Round } from "@/features/match/types/Round";

export interface MatchResultPlayerPoints {
  playerId: number;
  points: number;
}

export interface MatchResult {
  id: number;
  playerPoints: MatchResultPlayerPoints[];
}

export type MatchState = "NotActive" | "Active" | "Pending" | "Completed";
export type AdvancementCompetitionKind = "match" | "phase_group";

export interface AdvancementRule {
  id?: number;
  sourceKind: AdvancementCompetitionKind;
  sourceId: number;
  sourcePlacement: number;
  targetKind: AdvancementCompetitionKind;
  targetId: number;
  targetSlot: number;
}

export type AdvancementRuleInput = Pick<AdvancementRule, "sourcePlacement" | "targetKind" | "targetId" | "targetSlot">;
export type MatchAdvancementRuleInput = AdvancementRuleInput;

export interface Match {
  id: number;
  name: string;
  subtitle: string;
  notes: string;
  scoringSystem: string;
  state: MatchState;
  entrants: Entrant[];
  rounds: Round[];
  advancementRules: AdvancementRule[];
  matchResult?: MatchResult | null;
  phaseGroupId: number;
}
