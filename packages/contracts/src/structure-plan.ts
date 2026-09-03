import type { EntrantType } from './vocabulary';

/**
 * A proposed change to a tournament's structure, in a form that can be drawn
 * before it is written.
 *
 * Three things produce structure — somebody typing it, a bracket generator, and
 * a start.gg import — and they used to produce three different shapes, drawn by
 * three different surfaces and written by three different paths. They produce
 * this instead. The renderer draws a plan, the applier writes one, and the
 * validation that a client-supplied graph needs is written once rather than
 * once per producer.
 *
 * Nothing here holds a database id except where a node says which row it links
 * to. Everything else references a `localId`, which is what lets a plan be
 * built, drawn and edited before any of it exists.
 */

/** What applying the plan does with one node. */
export type PlanAction = 'create' | 'link' | 'skip';

export type PlanNodeKind = 'division' | 'phase' | 'phaseGroup' | 'match' | 'participant' | 'entrant';

/** How a `link` was decided, which is not the same as how confident it is. */
export type PlanLinkEvidence = 'mapping' | 'name';

/**
 * Why a node cannot be settled without a person.
 *
 * A plan is applied as it stands, so this never blocks anything; it is what the
 * panel counts and what the reviewer is sent to look at.
 */
export type PlanAttention = 'ambiguous-person' | 'no-tournament-scope';

/** Where a node came from, when its producer reads an external system. */
export type PlanExternalIdentity = {
    provider: 'startgg';
    externalType: string;
    externalId: string;
};

export type PlanNode = {
    /** Unique within the plan. Parents and routes reference this, never a row. */
    localId: string;
    kind: PlanNodeKind;
    /** The node this one hangs under. Absent for a node that hangs off the tournament. */
    parentLocalId?: string | null;
    action: PlanAction;
    /** The row this node is the same thing as, when the action is `link`. */
    localRowId?: number | null;
    linkEvidence?: PlanLinkEvidence | null;
    needsAttention?: PlanAttention | null;
    external?: PlanExternalIdentity | null;
    name: string;

    /* Kind-specific data. A reader takes what its kind uses and ignores the rest;
       a plan that carried one shape per kind would be six plans in a union. */
    subtitle?: string | null;
    bracketType?: string | null;
    scoringSystem?: string | null;
    /** Entrants seated in a match, by their node's local id, in slot order. */
    entrantLocalIds?: string[];
    /** The participants an entrant is made of, by their node's local id. */
    participantLocalIds?: string[];
    /** A seeding number an entrant arrives with. */
    seedNum?: number | null;
    entrantType?: EntrantType | null;
    /** The player a participant node already resolves to, when one is known. */
    localPlayerId?: number | null;
};

/**
 * Where the finishers of one node go.
 *
 * Both ends are local ids, so a route can be drawn between two nodes that do
 * not exist yet — which is the whole point of generating a bracket before
 * writing it.
 */
export type PlanRoute = {
    sourceLocalId: string;
    /** One-based finishing place. */
    sourcePlacement: number;
    targetLocalId: string;
    /** One-based slot in the target. */
    targetSlot: number;
};

/** What produced the plan, so the panel can say and the reader can judge. */
export type PlanSource =
    | { kind: 'manual' }
    | { kind: 'generator'; bracketType: string; playerPerMatch: number }
    | { kind: 'startgg'; eventSlug: string; eventName: string; readAt: string };

/**
 * The version of each division the plan was computed against.
 *
 * Applying a plan whose basis has moved is refused rather than merged: a
 * preview left open while somebody else edits references rows that may be gone,
 * and writing it would be worse than asking for it to be recomputed. A plan
 * that only creates new divisions depends on nothing and carries none.
 */
export type PlanBasis = {
    divisionId: number;
    structureVersion: number;
};

export type StructurePlan = {
    tournamentId: number;
    source: PlanSource;
    basedOn: PlanBasis[];
    nodes: PlanNode[];
    routes: PlanRoute[];
};

/** What a plan will do, counted by kind. The panel reads this; apply does not. */
export type PlanCountsDto = {
    kind: PlanNodeKind;
    create: number;
    link: number;
    skip: number;
};

export type StructurePlanAppliedDto = {
    tournamentId: number;
    /** The rows the plan created or linked, by the local id that named them. */
    rowIdByLocalId: Record<string, number>;
};
