import type { Status } from "@/shared/components/ui/status";
import type { PhaseGroup } from "@/features/division/model/types";
import type { Match } from "@/features/match/model/types";
import type { TournamentDivisionOption, TournamentDivisionOptionPhase } from "@/features/tournament/model/types";
import { phaseStatus, poolStatus } from "@/features/tournament/model/treeStatus";
import { getMatchProgress, getMatchProgressStatus } from "@/features/match/model/matchStatus";

/**
 * Where everything on the Structure canvas sits.
 *
 * A division is drawn as one column per phase, left to right in the order they
 * run, with the routes between them in the gaps. Nothing here knows about React:
 * it answers with rectangles and paths, which is what makes the arithmetic —
 * where a card lands, where an edge leaves and arrives, how wide the canvas has
 * to be — something that can be read and tested on its own.
 *
 * The same geometry serves both modes. Building shows a division as its pools;
 * routing shows the matches under them, because a route runs between whichever
 * two of those the person drawing it means. Nothing about the columns, the
 * cards or the curves changes with the mode — only what is on the canvas does.
 */

export const COLUMN_WIDTH = 236;
export const COLUMN_GAP = 46;
export const HEADER_HEIGHT = 54;
export const CARD_GAP = 10;
export const SLOT_HEIGHT = 38;
export const ADD_COLUMN_WIDTH = 46;
/** How far a match sits inside the pool it belongs to, when both are drawn. */
export const NEST_INDENT = 14;
const FIRST_CARD_TOP = HEADER_HEIGHT + CARD_GAP;
const NESTED_GAP = 6;

/*
 * What one line inside a card is worth.
 *
 * A card used to be one of two constants, and both of them were too short: a
 * match declaring 56 pixels drew a name, its pool and two slots, which is
 * nearer ninety, so every card in the column sat on top of the one below it.
 * The height is measured from what the card holds instead, and these are the
 * pieces it is measured in - kept beside the arithmetic that uses them so a
 * line added to the card is a line added here.
 */
const CARD_PADDING_Y = 8;
const NAME_ROW = 20;
const META_ROW = 16;
const SLOT_ROW = 18;
const SLOT_BLOCK_GAP = 2;
const CHIP_ROW = 20;
const CHIP_BLOCK_GAP = 6;
/** Four short placement chips fit across a column before one wraps. */
const CHIPS_PER_ROW = 4;

/**
 * What the canvas is for at this moment.
 *
 * Building is about what exists: pools under phases, and a dashed slot at the
 * end of every list. Routing is about what leads where — the matches come out
 * from under their pool, the placements and the slots come forward, and the
 * slots that would add another card go away, because adding one is not what
 * anybody is doing there.
 */
export type CanvasMode = "build" | "routes";

/** A chip on a card: one finishing place, and where it goes if anywhere. */
export type PlacementChip = {
    placement: number;
    label: string;
    routed: boolean;
};

export type CanvasCard = {
    key: string;
    kind: "pool" | "match";
    id: number;
    name: string;
    status: Status;
    /** Lines under the name, in the order they are drawn. */
    meta: string[];
    chips: PlacementChip[];
    /** Slots of a match and where each one comes from. */
    slots: { slot: number; from: string | null }[];
    top: number;
    height: number;
    /** Where the card starts inside its column, and how wide it is from there. */
    left: number;
    width: number;
    /** The pool a nested match hangs under, which is what a route falls back to. */
    poolId: number;
    /** Drawn but not written: the draft would make it, and Commit has not run. */
    pending: boolean;
};

export type CanvasColumn = {
    phaseId: number;
    name: string;
    status: Status;
    meta: string;
    left: number;
    cards: CanvasCard[];
    /** Where the dashed slot that adds another card sits. */
    slotTop: number;
    slotLabel: string;
};

export type CanvasEdge = {
    key: string;
    path: string;
    /** A route touching the selection is drawn in the accent, like any selection. */
    highlighted: boolean;
};

export type StructureCanvas = {
    columns: CanvasColumn[];
    edges: CanvasEdge[];
    width: number;
    height: number;
    addColumnLeft: number;
    /** Placements that lead nowhere, which is what the header counts. */
    danglingPlacements: number;
};

export type CanvasSelection = { kind: "pool" | "match"; id: number } | null;

/** The placement a route is being drawn from, waiting for somewhere to land. */
export type ArmedPlacement = { kind: "pool" | "match"; id: number; placement: number };

export type StructureCanvasInput = {
    division: TournamentDivisionOption | undefined;
    matches: Match[];
    mode: CanvasMode;
    selection: CanvasSelection;
    /** The card keys a draft would create, drawn as not there yet. */
    pending?: Set<string>;
    /** How many placements a pool is expected to send on, when nothing says. */
    advancingPlaces?: number;
};

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];

export function ordinal(placement: number): string {
    return ORDINALS[placement - 1] ?? `${placement}th`;
}

/**
 * How tall a card has to be to hold what is in it.
 *
 * The first line of `meta` rides the name row, so only the rest of it costs a
 * line. Everything else stacks: the slots a match is waiting on, and the
 * placements it sends on, four to a row.
 */
export function cardHeight(card: Pick<CanvasCard, "meta" | "chips" | "slots">): number {
    let height = CARD_PADDING_Y * 2 + NAME_ROW;

    height += Math.max(card.meta.length - 1, 0) * META_ROW;
    if (card.slots.length > 0) {
        height += SLOT_BLOCK_GAP + card.slots.length * SLOT_ROW;
    }
    if (card.chips.length > 0) {
        height += CHIP_BLOCK_GAP + Math.ceil(card.chips.length / CHIPS_PER_ROW) * CHIP_ROW;
    }

    return height;
}

export function buildStructureCanvas(input: StructureCanvasInput): StructureCanvas {
    const phases = input.division?.phases ?? [];
    const matchesByPool = groupMatchesByPool(input.matches);
    const advancingPlaces = input.advancingPlaces ?? 2;

    const pending = input.pending ?? new Set<string>();

    const columns = phases.map((phase, index) => {
        const left = index * (COLUMN_WIDTH + COLUMN_GAP);
        const cards = input.mode === "routes" ? routingCards(phase, matchesByPool, pending) : poolCards(phase, matchesByPool, advancingPlaces, pending);
        const last = cards.at(-1);

        return {
            phaseId: phase.id,
            name: phase.name,
            status: phaseStatus(phase),
            meta: phaseMeta(phase),
            left,
            cards,
            slotTop: last ? last.top + last.height + CARD_GAP : FIRST_CARD_TOP,
            slotLabel: "Pool",
        };
    });

    const edges = buildEdges(input, anchorsOf(columns));
    const contentHeight = Math.max(...columns.map((column) => column.slotTop + SLOT_HEIGHT), FIRST_CARD_TOP + SLOT_HEIGHT);
    const addColumnLeft = columns.length * (COLUMN_WIDTH + COLUMN_GAP);

    return {
        columns,
        edges,
        width: addColumnLeft + ADD_COLUMN_WIDTH,
        height: contentHeight,
        addColumnLeft,
        danglingPlacements: countDangling(phases, advancingPlaces),
    };
}

function groupMatchesByPool(matches: Match[]): Map<number, Match[]> {
    const byPool = new Map<number, Match[]>();
    for (const match of matches) {
        byPool.set(match.phaseGroupId, [...(byPool.get(match.phaseGroupId) ?? []), match]);
    }

    return byPool;
}

function phaseMeta(phase: TournamentDivisionOptionPhase): string {
    const pools = phase.phaseGroups ?? [];
    const poolPart = `${pools.length} ${pools.length === 1 ? "pool" : "pools"}`;

    return `${poolPart} · ${phase.matchCount} ${phase.matchCount === 1 ? "match" : "matches"}`;
}

/** A card at rest, told where it sits and asked how tall that makes it. */
function sized(card: Omit<CanvasCard, "top" | "height">, top: number): CanvasCard {
    return { ...card, top, height: cardHeight(card) };
}

function poolCards(phase: TournamentDivisionOptionPhase, matchesByPool: Map<number, Match[]>, advancingPlaces: number, pending: Set<string>): CanvasCard[] {
    let top = FIRST_CARD_TOP;

    return (phase.phaseGroups ?? []).map((pool) => {
        const card = sized(poolCard(pool, matchesByPool, placementChips(pool, advancingPlaces), pending), top);
        top += card.height + CARD_GAP;

        return card;
    });
}

/**
 * A pool and the matches inside it, which is what a route runs between.
 *
 * Both granularities are on the canvas at once because both are ends of a real
 * rule: the winners of a pool go to a bracket, and the winner of one match goes
 * to the next. Drawing one at a time is what made a route disappear when the
 * view changed rather than when the rule did.
 */
function routingCards(phase: TournamentDivisionOptionPhase, matchesByPool: Map<number, Match[]>, pending: Set<string>): CanvasCard[] {
    const cards: CanvasCard[] = [];
    let top = FIRST_CARD_TOP;

    for (const pool of phase.phaseGroups ?? []) {
        const card = sized(poolCard(pool, matchesByPool, routedChips(poolRulesOf(pool)), pending), top);
        cards.push(card);
        top += card.height + NESTED_GAP;

        for (const match of matchesByPool.get(pool.id) ?? []) {
            const nested = sized(matchCard(match, pool, pending), top);
            cards.push(nested);
            top += nested.height + NESTED_GAP;
        }

        top += CARD_GAP - NESTED_GAP;
    }

    return cards;
}

function poolCard(
    pool: PhaseGroup,
    matchesByPool: Map<number, Match[]>,
    chips: PlacementChip[],
    pending: Set<string>,
): Omit<CanvasCard, "top" | "height"> {
    return {
        key: poolKey(pool.id),
        kind: "pool",
        id: pool.id,
        name: pool.name,
        status: poolStatus(pool),
        meta: [`${pool.matchCount} ${pool.matchCount === 1 ? "match" : "matches"}`, poolProgress(pool, matchesByPool)],
        chips,
        slots: [],
        left: 0,
        width: COLUMN_WIDTH,
        poolId: pool.id,
        pending: pending.has(poolKey(pool.id)),
    };
}

function matchCard(match: Match, pool: PhaseGroup, pending: Set<string>): Omit<CanvasCard, "top" | "height"> {
    return {
        key: matchKey(match.id),
        kind: "match",
        id: match.id,
        name: match.name,
        status: getMatchProgressStatus(getMatchProgress(match)),
        meta: [],
        chips: routedChips((match.advancementRules ?? []).filter((rule) => rule.sourceKind === "match" && rule.sourceId === match.id)),
        slots: matchSlots(match),
        left: NEST_INDENT,
        width: COLUMN_WIDTH - NEST_INDENT,
        poolId: pool.id,
        pending: pending.has(matchKey(match.id)),
    };
}

function poolProgress(pool: PhaseGroup, matchesByPool: Map<number, Match[]>): string {
    if ((pool.pendingMatchCount ?? 0) > 0) {
        return `${pool.pendingMatchCount} waiting to commit`;
    }
    if ((pool.progressedMatchCount ?? 0) > 0) {
        return `${pool.progressedMatchCount} of ${pool.matchCount} played`;
    }

    return matchesByPool.has(pool.id) || pool.matchCount > 0 ? "not started" : "no matches";
}

/**
 * A pool shows the places it sends on, and marks the ones that go nowhere with
 * the dashed outline creation already uses. A place with no route is not an
 * error — it is a thing not decided yet, which is exactly what a dash says.
 */
function placementChips(pool: PhaseGroup, advancingPlaces: number): PlacementChip[] {
    const routed = new Set(poolRulesOf(pool).map((rule) => rule.sourcePlacement));
    const places = new Set<number>([...routed]);
    for (let placement = 1; placement <= advancingPlaces; placement++) {
        places.add(placement);
    }

    return [...places].sort((left, right) => left - right).map((placement) => ({ placement, label: ordinal(placement), routed: routed.has(placement) }));
}

/**
 * The places already routed, plus one dashed handle for the next of them.
 *
 * A match has no expected number of places to send on the way a pool does: a
 * two-player match has a loser, and in a single elimination bracket the loser
 * is meant to go nowhere. Offering every place would report a whole bracket as
 * unfinished, so what is offered is what is used, plus one more.
 */
function routedChips(rules: { sourcePlacement: number }[]): PlacementChip[] {
    const routed = [...new Set(rules.map((rule) => rule.sourcePlacement))].sort((left, right) => left - right);
    const next = (routed.at(-1) ?? 0) + 1;

    return [...routed.map((placement) => ({ placement, label: ordinal(placement), routed: true })), { placement: next, label: ordinal(next), routed: false }];
}

function poolRulesOf(pool: PhaseGroup): NonNullable<PhaseGroup["advancementRules"]> {
    return (pool.advancementRules ?? []).filter((rule) => rule.sourceKind === "phase_group" && rule.sourceId === pool.id);
}

/**
 * Who arrives in each slot of a match.
 *
 * A slot filled by a route reads as the place it comes from rather than as a
 * gap, which is the same sentence `PathRow` already draws over a match table.
 */
function matchSlots(match: Match): { slot: number; from: string | null }[] {
    const incoming = (match.advancementRules ?? []).filter((rule) => rule.targetKind === "match" && rule.targetId === match.id);
    const slotCount = Math.max(match.entrants?.length ?? 0, ...incoming.map((rule) => rule.targetSlot), 2);

    return Array.from({ length: slotCount }, (_, index) => {
        const slot = index + 1;
        const rule = incoming.find((candidate) => candidate.targetSlot === slot);
        if (rule) {
            return { slot, from: `${ordinal(rule.sourcePlacement)} of ${rule.sourceName ?? "elsewhere"}` };
        }

        const entrant = match.entrants?.[index];

        return { slot, from: entrant ? entrant.name : null };
    });
}

type Anchor = { left: number; right: number; y: number };

function anchorsOf(columns: CanvasColumn[]): Map<string, Anchor> {
    const anchors = new Map<string, Anchor>();

    for (const column of columns) {
        for (const card of column.cards) {
            anchors.set(card.key, { left: column.left + card.left, right: column.left + card.left + card.width, y: card.top + card.height / 2 });
        }
    }

    return anchors;
}

type CanvasRule = { sourceKind: "pool" | "match"; sourceId: number; targetKind: "pool" | "match"; targetId: number };

/**
 * The routes, as curves that leave the right edge of a card and arrive at the
 * left edge of another. Both ends are horizontal, so a route reads as a flow
 * from one column into the next however far apart the two cards are vertically.
 *
 * Every rule is drawn in every mode. A rule whose end is not a card on this
 * canvas — a match, while the canvas is showing pools — is drawn to the pool
 * that holds it, so a route disappears when the rule does and not when the view
 * changes.
 */
function buildEdges(input: StructureCanvasInput, anchors: Map<string, Anchor>): CanvasEdge[] {
    const edges: CanvasEdge[] = [];
    const seen = new Set<string>();
    const poolOfMatch = new Map(input.matches.map((match) => [match.id, match.phaseGroupId]));

    function anchorOf(kind: "pool" | "match", id: number): Anchor | undefined {
        const own = anchors.get(kind === "pool" ? poolKey(id) : matchKey(id));
        if (own || kind === "pool") {
            return own;
        }

        const poolId = poolOfMatch.get(id);

        return poolId === undefined ? undefined : anchors.get(poolKey(poolId));
    }

    for (const rule of allRules(input)) {
        const source = anchorOf(rule.sourceKind, rule.sourceId);
        const target = anchorOf(rule.targetKind, rule.targetId);
        if (!source || !target || source === target) {
            continue;
        }

        const key = `${rule.sourceKind}:${rule.sourceId}->${rule.targetKind}:${rule.targetId}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);

        const midpoint = source.right + (target.left - source.right) / 2;
        edges.push({
            key,
            path: `M ${source.right} ${source.y} C ${midpoint} ${source.y}, ${midpoint} ${target.y}, ${target.left} ${target.y}`,
            highlighted: touchesSelection(input.selection, rule),
        });
    }

    return edges;
}

/** Every rule the division holds, whichever end of it the canvas is drawing. */
function allRules(input: StructureCanvasInput): CanvasRule[] {
    const pools = (input.division?.phases ?? []).flatMap((phase) => phase.phaseGroups ?? []);

    const fromPools = pools.flatMap((pool) =>
        poolRulesOf(pool).map((rule) => ({
            sourceKind: "pool" as const,
            sourceId: pool.id,
            targetKind: rule.targetKind === "phase_group" ? ("pool" as const) : ("match" as const),
            targetId: rule.targetId,
        })),
    );

    const fromMatches = input.matches.flatMap((match) =>
        (match.advancementRules ?? [])
            .filter((rule) => rule.sourceKind === "match" && rule.sourceId === match.id)
            .map((rule) => ({
                sourceKind: "match" as const,
                sourceId: match.id,
                targetKind: rule.targetKind === "phase_group" ? ("pool" as const) : ("match" as const),
                targetId: rule.targetId,
            })),
    );

    return [...fromPools, ...fromMatches];
}

function touchesSelection(selection: CanvasSelection, rule: CanvasRule): boolean {
    if (!selection) {
        return false;
    }

    return (rule.sourceKind === selection.kind && rule.sourceId === selection.id) || (rule.targetKind === selection.kind && rule.targetId === selection.id);
}

/**
 * How many places lead nowhere across the whole division.
 *
 * It is the one number no dialog could ever produce, because no dialog sees
 * more than the node it was opened on. It counts pools: a match sends on what
 * it is asked to send on, and a bracket is not unfinished for having losers.
 */
function countDangling(phases: TournamentDivisionOptionPhase[], advancingPlaces: number): number {
    const pools = phases.flatMap((phase) => phase.phaseGroups ?? []);
    /* The last phase is where a tournament ends, so its winners are not expected
       to go anywhere and are not counted as missing. */
    const terminal = new Set((phases.at(-1)?.phaseGroups ?? []).map((pool) => pool.id));

    return pools
        .filter((pool) => !terminal.has(pool.id))
        .reduce((total, pool) => total + placementChips(pool, advancingPlaces).filter((chip) => !chip.routed).length, 0);
}

export function poolKey(id: number): string {
    return `pool:${id}`;
}

export function matchKey(id: number): string {
    return `match:${id}`;
}
