export type DivisionSummaryPlayerDto = {
    id: number;
    playerName: string;
};

export type DivisionSummaryParticipantDto = {
    id: number;
    roles: string[];
    status: string;
    player: DivisionSummaryPlayerDto;
};

export type DivisionSummaryEntrantDto = {
    id: number;
    name: string;
    type: string;
    status: string;
    participants: DivisionSummaryParticipantDto[];
};

export type DivisionSummaryPhaseGroupEntrantDto = {
    id: number;
    seedNum: number | null;
    slot: number | null;
    status: string;
    entrant: DivisionSummaryEntrantDto;
};

export type DivisionSummaryPhaseGroupDto = {
    id: number;
    name: string;
    displayIdentifier: string | null;
    bracketType: string | null;
    state: string;
    entrants: DivisionSummaryPhaseGroupEntrantDto[];
    matchCount: number;
    advancementRules?: Array<{
        id: number;
        sourceKind: string;
        sourceId: number;
        sourcePlacement: number;
        targetKind: string;
        targetId: number;
        targetSlot: number;
    }>;
};

export type DivisionSummaryPhaseDto = {
    id: number;
    name: string;
    matchCount: number;
    phaseGroups: DivisionSummaryPhaseGroupDto[];
};

export type DivisionSummaryDto = {
    id: number;
    name: string;
    entrants: DivisionSummaryEntrantDto[];
    phases: DivisionSummaryPhaseDto[];
};
