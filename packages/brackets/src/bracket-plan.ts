import type { BracketType } from './bracket-type';

/*
 * What a bracket is, before anything has been written.
 *
 * A plan holds matches under local identifiers, and every reference between
 * them - a route, a seat - is expressed against those identifiers rather than
 * against database rows. That is what lets the same function draw a preview in
 * a browser and be persisted by the API, and it is why nothing here is async.
 */

/** Which half of a bracket a round belongs to, for naming and grouping. */
export type BracketRoundKind = 'single' | 'winners' | 'losers' | 'final';

export type BracketMatchDescriptor = {
    kind: BracketRoundKind;
    /** 0-based, within its own side of the bracket. */
    roundIndex: number;
    /** How many rounds that side has. */
    roundCount: number;
    /** 0-based, within its round. */
    matchIndex: number;
    /** How many matches the round holds. */
    matchCount: number;
};

export type BracketMatchNamer = (descriptor: BracketMatchDescriptor) => string;

export type BracketPlanMatch = {
    /** Unique within the plan. Routes and seats reference this, never an index. */
    localId: string;
    name: string;
    /** The round this match belongs to, as a label a reader can group by. */
    round: string;
};

export type BracketPlanRoute = {
    sourceMatchLocalId: string;
    /** 1-based finishing place, the way an advancement rule states it. */
    sourcePlacement: number;
    targetMatchLocalId: string;
    /** 1-based slot in the target match. */
    targetSlot: number;
};

export type BracketPlanSeat = {
    matchLocalId: string;
    /** 1-based slot in the match. */
    slot: number;
    /** Index into the seeded entrants the caller supplied, in seeding order. */
    seedIndex: number;
};

export type BracketPlan = {
    bracketType: BracketType;
    playerPerMatch: number;
    entrantCount: number;
    /** How many first-round slots nobody fills. */
    byes: number;
    matches: BracketPlanMatch[];
    routes: BracketPlanRoute[];
    seats: BracketPlanSeat[];
};

export type BracketPlanInput = {
    entrantCount: number;
    playerPerMatch?: number;
    /** Overrides the readable default names, for a caller with its own scheme. */
    name?: BracketMatchNamer;
};

/**
 * The readable default.
 *
 * A generated bracket used to be named `Round_1_Match_0` with the note
 * `MatchDescription`, which is the actual reason every generated bracket was
 * edited immediately afterwards. The last three rounds carry the names people
 * already use for them; anything earlier keeps a round and a number, because
 * there is no shared word for the round of thirty-two.
 */
export const defaultMatchName: BracketMatchNamer = (descriptor) => {
    const number = descriptor.matchIndex + 1;
    const side = descriptor.kind === 'winners' ? 'Winners ' : descriptor.kind === 'losers' ? 'Losers ' : '';

    if (descriptor.kind === 'final') {
        return descriptor.matchCount === 1 ? 'Grand Final' : `Final ${number}`;
    }
    if (descriptor.matchCount === 1) {
        return descriptor.kind === 'single' ? 'Grand Final' : `${side}Final`;
    }
    if (descriptor.kind === 'single' && descriptor.matchCount === 2) {
        return `Semifinal ${number}`;
    }
    if (descriptor.kind === 'single' && descriptor.matchCount === 4) {
        return `Quarter ${number}`;
    }

    return `${side}Round ${descriptor.roundIndex + 1} Match ${number}`;
};

/** The smallest power of two at or above `value`. */
export function nextPow2(value: number): number {
    let power = 1;
    while (power < value) {
        power *= 2;
    }

    return power;
}
