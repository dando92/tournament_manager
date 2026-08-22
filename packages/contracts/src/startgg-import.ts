import type { EntrantType } from './vocabulary';

/**
 * What a start.gg import would do, and what it did.
 *
 * The preview is a plan: every row carries the action the import will take and
 * the local row it matched, so the person confirming sees the writes before
 * they happen.
 */

export type StartggImportEventDto = {
    id: string;
    name: string;
    slug: string;
    tournament?: { id: string; name: string; slug?: string | null } | null;
    phases: Array<{ id: string; name: string }>;
};

export type StartggImportParticipantPlanDto = {
    externalId: string;
    gamerTag: string;
    action: string;
    localParticipantId: number | null;
    localPlayerId: number | null;
};

export type StartggImportEntrantPlanDto = {
    externalId: string;
    name: string;
    type: EntrantType;
    seedNum: number | null;
    action: string;
    localEntrantId: number | null;
    participantExternalIds: string[];
};

export type StartggImportPhasePlanDto = {
    externalId: string;
    name: string;
    action: string;
    localPhaseId: number | null;
};

export type StartggImportMatchPlanDto = {
    externalId: string;
    name: string;
    action: string;
    localMatchId: number | null;
    phaseExternalId: string;
    entrantExternalIds: string[];
};

export type StartggImportCountsDto = {
    participants: number;
    entrants: number;
    phases: number;
    matches: number;
};

export type StartggImportPreviewResponseDto = {
    event: StartggImportEventDto;
    targetTournamentId: number | null;
    mode: string;
    division: {
        externalId: string;
        name: string;
        action: string;
        localDivisionId: number | null;
    };
    counts: StartggImportCountsDto;
    participants: StartggImportParticipantPlanDto[];
    entrants: StartggImportEntrantPlanDto[];
    phases: StartggImportPhasePlanDto[];
    matches: StartggImportMatchPlanDto[];
};

export type StartggImportResponseDto = {
    tournamentId: number;
    divisionId: number;
    imported: StartggImportCountsDto;
};
