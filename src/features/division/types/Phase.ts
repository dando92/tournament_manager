import { Match } from "@/features/match/types/Match";
import { Entrant } from "@/features/entrant/types/Entrant";
import { AdvancementRule } from "@/features/match/types/Match";

export type PhaseGroupState = "pending" | "active" | "completed";

export interface PhaseGroupEntrant {
  id: number;
  seedNum: number | null;
  slot: number | null;
  status: "pending" | "active" | "advanced" | "eliminated" | "withdrawn" | "dq";
  entrant: Entrant;
}

export interface PhaseGroup {
  id: number;
  name: string;
  displayIdentifier: string | null;
  bracketType: string | null;
  state: PhaseGroupState;
  entrants: PhaseGroupEntrant[];
  matchCount: number;
  advancementRules?: AdvancementRule[];
}

export type PhaseGroupAdvancementRuleInput = Pick<AdvancementRule, "sourcePlacement" | "targetId" | "targetSlot">;

export interface Phase {
  id: number;
  name: string;
  matches?: Match[];
  matchCount?: number;
  phaseGroups?: PhaseGroup[];
}
