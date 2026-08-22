import type { AdvancementRuleInput } from "@/features/match/model/types";

export type {
  DivisionPhaseDto as Phase,
  PhaseGroupDto as PhaseGroup,
  PhaseGroupEntrantDto as PhaseGroupEntrant,
  PhaseGroupState,
} from "@tournament-manager/contracts";

export type PhaseGroupAdvancementRuleInput = AdvancementRuleInput;
