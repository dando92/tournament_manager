export type StartggImportMode = "create-division";

export type StartggImportPreviewRequest = {
  eventSlug: string;
  targetTournamentId?: number;
  mode?: StartggImportMode;
};

export type StartggImportEventSummary = {
  id: string;
  name: string;
  slug: string;
  tournament?: {
    id: string;
    name: string;
    slug?: string | null;
  } | null;
  phases: Array<{
    id: string;
    name: string;
  }>;
};

export type StartggImportPreviewParticipant = {
  externalId: string;
  gamerTag: string;
  action: string;
  localParticipantId: number | null;
  localPlayerId: number | null;
};

export type StartggImportPreviewEntrant = {
  externalId: string;
  name: string;
  type: "player" | "team";
  seedNum: number | null;
  action: string;
  localEntrantId: number | null;
  participantExternalIds: string[];
};

export type StartggImportPreviewPhase = {
  externalId: string;
  name: string;
  action: string;
  localPhaseId: number | null;
};

export type StartggImportPreviewMatch = {
  externalId: string;
  name: string;
  action: string;
  localMatchId: number | null;
  phaseExternalId: string;
  entrantExternalIds: string[];
};

export type StartggImportPreviewResponse = {
  event: StartggImportEventSummary;
  targetTournamentId: number | null;
  mode: string;
  division: {
    externalId: string;
    name: string;
    action: string;
    localDivisionId: number | null;
  };
  counts: {
    participants: number;
    entrants: number;
    phases: number;
    matches: number;
  };
  participants: StartggImportPreviewParticipant[];
  entrants: StartggImportPreviewEntrant[];
  phases: StartggImportPreviewPhase[];
  matches: StartggImportPreviewMatch[];
};

export type StartggImportResponse = {
  tournamentId: number;
  divisionId: number;
  imported: {
    participants: number;
    entrants: number;
    phases: number;
    matches: number;
  };
};
