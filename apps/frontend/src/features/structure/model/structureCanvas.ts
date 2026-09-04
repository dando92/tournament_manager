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
 */

export const COLUMN_WIDTH = 236;
export const COLUMN_GAP = 46;
export const HEADER_HEIGHT = 54;
export const CARD_GAP = 10;
export const SLOT_HEIGHT = 38;
export const ADD_COLUMN_WIDTH = 46;
const FIRST_CARD_TOP = HEADER_HEIGHT + CARD_GAP;

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

export type CanvasDensity = "pools" | "matches";

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
    /** Slots of a match and where each one comes from, in the match density. */
    slots: { slot: number; from: string | null }[];
    top: number;
    height: number;
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

export type StructureCanvasInput = {
    division: TournamentDivisionOption | undefined;
    matches: Match[];
    density: CanvasDensity;
    selection: CanvasSelection;
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
 * placements a pool sends on, four to a row.
 */
export function cardHeight(card: Pick<CanvasCard, 'meta' | 'chips' | 'slots'>): number {
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
    const anchors = new Map<string, { x: number; y: number; right: number }>();

    const columns = phases.map((phase, index) => {
        const left = index * (COLUMN_WIDTH + COLUMN_GAP);
        const cards =
            input.density === "matches"
                ? matchCards(phase, matchesByPool)
                : poolCards(phase, matchesByPool, input.advancingPlaces ?? 2);

        for (const card of cards) {
            anchors.set(card.key, { x: left, y: card.top + card.height / 2, right: left + COLUMN_WIDTH });
        }

        const last = cards.at(-1);
        return {
            phaseId: phase.id,
            name: phase.name,
            status: phaseStatus(phase),
            meta: phaseMeta(phase, input.density),
            left,
            cards,
            slotTop: last ? last.top + last.height + CARD_GAP : FIRST_CARD_TOP,
            slotLabel: input.density === "matches" ? "Match" : "Pool",
        };
    });

    const edges = buildEdges(input, anchors);
    const contentHeight = Math.max(...columns.map((column) => column.slotTop + SLOT_HEIGHT), FIRST_CARD_TOP + SLOT_HEIGHT);
    const addColumnLeft = columns.length * (COLUMN_WIDTH + COLUMN_GAP);

    return {
        columns,
        edges,
        width: addColumnLeft + ADD_COLUMN_WIDTH,
        height: contentHeight,
        addColumnLeft,
        danglingPlacements: countDangling(phases, input.advancingPlaces ?? 2),
    };
}

function groupMatchesByPool(matches: Match[]): Map<number, Match[]> {
    const byPool = new Map<number, Match[]>();
    for (const match of matches) {
        byPool.set(match.phaseGroupId, [...(byPool.get(match.phaseGroupId) ?? []), match]);
    }

    return byPool;
}

function phaseMeta(phase: TournamentDivisionOptionPhase, density: CanvasDensity): string {
    const pools = phase.phaseGroups ?? [];
    const poolPart = `${pools.length} ${pools.length === 1 ? "pool" : "pools"}`;
    const matchPart = `${phase.matchCount} ${phase.matchCount === 1 ? "match" : "matches"}`;

    return density === "matches" ? matchPart : `${poolPart} · ${matchPart}`;
}

function poolCards(phase: TournamentDivisionOptionPhase, matchesByPool: Map<number, Match[]>, advancingPlaces: number): CanvasCard[] {
    let top = FIRST_CARD_TOP;

    return (phase.phaseGroups ?? []).map((pool) => {
        const card: CanvasCard = {
            key: poolKey(pool.id),
            kind: "pool",
            id: pool.id,
            name: pool.name,
            status: poolStatus(pool),
            meta: [`${pool.matchCount} ${pool.matchCount === 1 ? "match" : "matches"}`, poolProgress(pool, matchesByPool)],
            chips: placementChips(pool, advancingPlaces),
            slots: [],
            top,
            height: 0,
        };
        card.height = cardHeight(card);
        top += card.height + CARD_GAP;

        return card;
    });
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
    const routed = new Set((pool.advancementRules ?? []).filter((rule) => rule.sourceKind === "phase_group").map((rule) => rule.sourcePlacement));
    const places = new Set<number>([...routed]);
    for (let placement = 1; placement <= advancingPlaces; placement++) {
        places.add(placement);
    }

    return [...places]
        .sort((left, right) => left - right)
        .map((placement) => ({ placement, label: ordinal(placement), routed: routed.has(placement) }));
}

function matchCards(phase: TournamentDivisionOptionPhase, matchesByPool: Map<number, Match[]>): CanvasCard[] {
    let top = FIRST_CARD_TOP;
    const cards: CanvasCard[] = [];

    for (const pool of phase.phaseGroups ?? []) {
        for (const match of matchesByPool.get(pool.id) ?? []) {
            const card: CanvasCard = {
                key: matchKey(match.id),
                kind: "match",
                id: match.id,
                name: match.name,
                status: getMatchProgressStatus(getMatchProgress(match)),
                meta: [pool.name],
                chips: [],
                slots: matchSlots(match),
                top,
                height: 0,
            };
            card.height = cardHeight(card);
            cards.push(card);
            top += card.height + CARD_GAP;
        }
    }

    return cards;
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

/**
 * The routes, as curves that leave the right edge of a card and arrive at the
 * left edge of another. Both ends are horizontal, so a route reads as a flow
 * from one column into the next however far apart the two cards are vertically.
 */
function buildEdges(input: StructureCanvasInput, anchors: Map<string, { x: number; y: number; right: number }>): CanvasEdge[] {
    const edges: CanvasEdge[] = [];
    const seen = new Set<string>();

    const rules = input.density === "matches" ? matchRules(input.matches) : poolRules(input.division);
    for (const rule of rules) {
        const source = anchors.get(rule.sourceKey);
        const target = anchors.get(rule.targetKey);
        if (!source || !target) {
            continue;
        }

        const key = `${rule.sourceKey}->${rule.targetKey}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);

        const midpoint = source.right + (target.x - source.right) / 2;
        edges.push({
            key,
            path: `M ${source.right} ${source.y} C ${midpoint} ${source.y}, ${midpoint} ${target.y}, ${target.x} ${target.y}`,
            highlighted: touchesSelection(input.selection, rule),
        });
    }

    return edges;
}

type CanvasRule = { sourceKey: string; targetKey: string; sourceId: number; targetId: number; kind: "pool" | "match" };

function poolRules(division: TournamentDivisionOption | undefined): CanvasRule[] {
    const pools = (division?.phases ?? []).flatMap((phase) => phase.phaseGroups ?? []);

    return pools.flatMap((pool) =>
        (pool.advancementRules ?? [])
            .filter((rule) => rule.sourceKind === "phase_group" && rule.sourceId === pool.id)
            .map((rule) => ({
                sourceKey: poolKey(pool.id),
                /* A route into a match is drawn to the pool that holds it while
                   the pools are what is on screen: the match is not a card yet. */
                targetKey: rule.targetKind === "phase_group" ? poolKey(rule.targetId) : matchKey(rule.targetId),
                sourceId: pool.id,
                targetId: rule.targetId,
                kind: "pool" as const,
            })),
    );
}

function matchRules(matches: Match[]): CanvasRule[] {
    return matches.flatMap((match) =>
        (match.advancementRules ?? [])
            .filter((rule) => rule.sourceKind === "match" && rule.sourceId === match.id)
            .map((rule) => ({
                sourceKey: matchKey(match.id),
                targetKey: rule.targetKind === "match" ? matchKey(rule.targetId) : poolKey(rule.targetId),
                sourceId: match.id,
                targetId: rule.targetId,
                kind: "match" as const,
            })),
    );
}

function touchesSelection(selection: CanvasSelection, rule: CanvasRule): boolean {
    if (!selection) {
        return false;
    }
    const key = selection.kind === "pool" ? poolKey(selection.id) : matchKey(selection.id);

    return rule.sourceKey === key || rule.targetKey === key;
}

/**
 * How many places lead nowhere across the whole division.
 *
 * It is the one number no dialog could ever produce, because no dialog sees
 * more than the node it was opened on.
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
