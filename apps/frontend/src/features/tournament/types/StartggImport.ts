export type {
  StartggImportEventDto as StartggImportEventSummary,
  StartggImportEntrantPlanDto as StartggImportPreviewEntrant,
  StartggImportMatchPlanDto as StartggImportPreviewMatch,
  StartggImportParticipantPlanDto as StartggImportPreviewParticipant,
  StartggImportPhasePlanDto as StartggImportPreviewPhase,
  StartggImportPreviewResponseDto as StartggImportPreviewResponse,
  StartggImportResponseDto as StartggImportResponse,
} from "@tournament-manager/contracts";

export type StartggImportMode = "create-division";

export type StartggImportPreviewRequest = {
  eventSlug: string;
  targetTournamentId?: number;
  mode?: StartggImportMode;
};
