import { Match } from "@/features/match/types/Match";
import { Entrant } from "@/features/entrant/types/Entrant";
import { AdvancementRule, AdvancementRuleInput } from "@/features/match/types/Match";

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
  /**
   * Matches waiting on a person: every score in, no result committed. Only the
   * tournament overview carries it, because only the tree needs it.
   */
  pendingMatchCount?: number;
  advancementRules?: AdvancementRule[];
}

export type PhaseGroupAdvancementRuleInput = AdvancementRuleInput;

export interface Phase {
  id: number;
  name: string;
  matches?: Match[];
  matchCount?: number;
  phaseGroups?: PhaseGroup[];
}
