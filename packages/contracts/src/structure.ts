import type { AdvancementRuleDto } from './match';
import type { EntrantDto } from './projections';
import type { PhaseGroupEntrantStatus, PhaseGroupState } from './vocabulary';

/**
 * The structure of a division: its entrants, its phases and the pools inside
 * them. `GET /divisions/:id/summary` returns the whole of it; the pool routes
 * return one node of it.
 */

/** An entrant's seat in a pool. `slot` is the bracket position, `seedNum` the order it was seeded in. */
export type PhaseGroupEntrantDto = {
    id: number;
    seedNum: number | null;
    slot: number | null;
    status: PhaseGroupEntrantStatus;
    entrant: EntrantDto;
};

export type PhaseGroupDto = {
    id: number;
    name: string;
    displayIdentifier: string | null;
    bracketType: string | null;
    state: PhaseGroupState;
    entrants: PhaseGroupEntrantDto[];
    matchCount: number;
    /**
     * Matches waiting on a person: every score in, no result committed. Only
     * the tournament overview carries it, because only the tree needs it.
     */
    pendingMatchCount?: number;
    advancementRules?: AdvancementRuleDto[];
};

export type DivisionPhaseDto = {
    id: number;
    name: string;
    matchCount: number;
    phaseGroups: PhaseGroupDto[];
};

export type DivisionSummaryDto = {
    id: number;
    name: string;
    entrants: EntrantDto[];
    phases: DivisionPhaseDto[];
};

/** One player's running total across a division, ordered by the API. */
export type DivisionStandingRowDto = {
    id: number;
    playerName: string;
    points: number;
    songsPlayed: number;
};

export type GenerateBracketResultDto = {
    phaseId: number;
    phaseGroupId: number;
};
