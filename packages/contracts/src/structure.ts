import type { AdvancementRuleDto } from './match';
import type { EntrantDto } from './projections';
import type { PhaseGroupEntrantStatus, PhaseGroupState } from './vocabulary';

/**
 * The structure a tournament is drawn from: its divisions, the phases inside
 * them and the pools inside those.
 *
 * One projection answers at three scopes. `GET /tournaments/:id/overview`
 * returns every division of a tournament, `GET /divisions/:id/summary` returns
 * one of them, and the pool routes return one node. They used to be two
 * projections that had drifted: the overview carried a pending count and no
 * advancement rules, the summary carried the rules and no pending count, and
 * both carried an `entrants` array on a pool that was always empty.
 *
 * A node states how many of a thing it holds, never the things themselves. The
 * roster of a division is a list of people rather than a count of them, so it
 * is read through `GET /divisions/:id/entrants` by the two pages that show it.
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
    matchCount: number;
    /** Matches waiting on a person: every score in, no result committed. */
    pendingMatchCount: number;
    /** Where the pool sends its finishers. Empty until somebody says. */
    advancementRules: AdvancementRuleDto[];
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
    /** Entrants still competing. A withdrawn one is in the roster and not in this count. */
    entrantCount: number;
    matchCount: number;
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
