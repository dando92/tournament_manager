import type { AdvancementRuleInput } from "@/features/match/model/types";

/**
 * What the division views read, under the names they read it by.
 *
 * The responses come from the contracts package; what is declared here is the
 * one request the feature sends and the alias the pool advancement editor uses,
 * which is the match rule seen from its other end.
 */
export type {
  DivisionSummaryDto as Division,
  DivisionPhaseDto as Phase,
  PhaseGroupDto as PhaseGroup,
  PhaseGroupState,
  GenerateBracketResultDto,
} from "@tournament-manager/contracts";

/** A rule as the pool editor holds it: the same draft a match rule is held as. */
export type PhaseGroupAdvancementRuleInput = AdvancementRuleInput;

export type GenerateBracketRequest = {
  divisionId: number;
  phaseName?: string;
  bracketType: string;
  playerPerMatch: number;
};
