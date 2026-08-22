import type { AdvancementRuleInput } from "@/features/match/types/Match";

export type {
  DivisionPhaseDto as Phase,
  PhaseGroupDto as PhaseGroup,
  PhaseGroupEntrantDto as PhaseGroupEntrant,
  PhaseGroupState,
} from "@tournament-manager/contracts";

export type PhaseGroupAdvancementRuleInput = AdvancementRuleInput;
