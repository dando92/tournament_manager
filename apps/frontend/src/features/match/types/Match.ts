import type { AdvancementRuleDto } from "@tournament-manager/contracts";

export type {
  AdvancementCompetitionKind,
  AdvancementRuleDto as AdvancementRule,
  MatchDto as Match,
  MatchResultDto as MatchResult,
  MatchResultEntryDto as MatchResultPlayerPoints,
} from "@tournament-manager/contracts";

export type MatchCommitState = "Disabled" | "Pending" | "Completed";

/**
 * A rule as the editor holds it before it is saved. The identifier is the
 * server's to assign, so a draft carries the four fields that describe the
 * destination and nothing else.
 */
export type AdvancementRuleInput = Pick<
  AdvancementRuleDto,
  "sourcePlacement" | "targetKind" | "targetId" | "targetSlot"
>;
export type MatchAdvancementRuleInput = AdvancementRuleInput;

/** Which match the interface is pointing at. A view concern, never a response. */
export type MatchHighlight = {
  matchId: number | null;
  phaseGroupId: number | null;
};
