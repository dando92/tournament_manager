import type { EntrantType } from './vocabulary';

/**
 * How a start.gg row reconciles against what is already here.
 *
 * Each row carries the action the import will take and the local row it
 * matched, in the vocabulary of the reconciliation itself. The preview no
 * longer answers with these: it answers with a StructurePlan, which is the
 * shape every producer of structure shares. They stay because they are what
 * the reconciliation computes before it is generalised.
 */

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

export type StartggImportResponseDto = {
    tournamentId: number;
    divisionId: number;
    imported: StartggImportCountsDto;
};
