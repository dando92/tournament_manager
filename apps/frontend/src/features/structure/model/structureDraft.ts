import type { AdvancementRuleDto, PlanNode, StructurePlan } from "@tournament-manager/contracts";
import type { PhaseGroup } from "@/features/division/model/types";
import type { Match } from "@/features/match/model/types";
import type { TournamentDivisionOption, TournamentDivisionOptionPhase } from "@/features/tournament/model/types";

/**
 * A whole change of shape, before any of it is written.
 *
 * The page used to write on every gesture: a pool created here, a rule saved
 * there, a rename somewhere else, each its own request and its own chance to
 * half-succeed. Building a division was a dozen writes that nothing tied
 * together, and the structure was only ever right at the end of them.
 *
 * A draft is what those gestures do instead. It records what somebody meant —
 * the phases they added, the names they changed, the routes they drew — and
 * `toStructurePlan` turns the lot into the one plan the applier writes in one
 * transaction. Nothing here talks to the network, and nothing is true until
 * that plan lands.
 *
 * A row that does not exist yet has no id, so it is given a negative one.
 * That is the whole trick: the canvas, the selection and the routes then treat
 * something that is about to exist exactly like something that does, and only
 * this file and the moment of writing know the difference.
 */

export type DraftKind = "phase" | "pool" | "match";

/** Something the draft can point at. A negative id has not been written yet. */
export type NodeRef = { kind: DraftKind; id: number };

export type RoutableKind = "pool" | "match";

export type DraftAddition = NodeRef & { parentId: number; name: string };
export type DraftRename = NodeRef & { name: string };
export type DraftRoute = { sourceKind: RoutableKind; sourceId: number; placement: number; targetKind: RoutableKind; targetId: number; slot: number };
export type DraftSlot = { targetKind: RoutableKind; targetId: number; slot: number };

export type StructureDraft = {
    tournamentId: number;
    divisionId: number;
    added: DraftAddition[];
    renamed: DraftRename[];
    removed: NodeRef[];
    routes: DraftRoute[];
    /** Routes taken away and not replaced. */
    cleared: DraftSlot[];
};

export function emptyDraft(tournamentId: number, divisionId: number): StructureDraft {
    return { tournamentId, divisionId, added: [], renamed: [], removed: [], routes: [], cleared: [] };
}

/** How much is waiting to be written, which is what the header says out loud. */
export function changeCount(draft: StructureDraft): number {
    return draft.added.length + draft.renamed.length + draft.removed.length + draft.routes.length + draft.cleared.length;
}

export function isPending(id: number): boolean {
    return id < 0;
}

function keyOf(ref: NodeRef): string {
    return `${ref.kind}:${ref.id}`;
}

function same(left: NodeRef, right: NodeRef): boolean {
    return left.kind === right.kind && left.id === right.id;
}

/** The next unwritten id. They run down from minus one, in the order they were made. */
function nextId(draft: StructureDraft): number {
    return Math.min(0, ...draft.added.map((node) => node.id)) - 1;
}

export function addNode(draft: StructureDraft, kind: DraftKind, parentId: number, name: string): StructureDraft {
    return { ...draft, added: [...draft.added, { kind, id: nextId(draft), parentId, name }] };
}

/**
 * Renaming something that is not written yet edits the addition; renaming a row
 * records the name it should have. Either way it is one edit and not an action
 * with a request behind it.
 */
export function renameNode(draft: StructureDraft, ref: NodeRef, name: string): StructureDraft {
    if (isPending(ref.id)) {
        return { ...draft, added: draft.added.map((node) => (same(node, ref) ? { ...node, name } : node)) };
    }

    return { ...draft, renamed: [...draft.renamed.filter((entry) => !same(entry, ref)), { ...ref, name }] };
}

/**
 * Taking something away takes its contents with it, the way the foreign keys
 * will. Everything the draft said about any of it is dropped rather than
 * carried to a plan that would name rows nobody can reach.
 */
export function removeNode(draft: StructureDraft, ref: NodeRef, tree: StructureIndex): StructureDraft {
    const gone = [ref, ...descendantsOf(ref, draft, tree)];
    const isGone = (candidate: NodeRef) => gone.some((entry) => same(entry, candidate));
    const touchesGone = (kind: RoutableKind, id: number) => isGone({ kind, id });

    return {
        ...draft,
        added: draft.added.filter((node) => !isGone(node)),
        renamed: draft.renamed.filter((entry) => !isGone(entry)),
        removed: [...draft.removed.filter((entry) => !isGone(entry)), ...gone.filter((entry) => !isPending(entry.id))],
        routes: draft.routes.filter((route) => !touchesGone(route.sourceKind, route.sourceId) && !touchesGone(route.targetKind, route.targetId)),
        cleared: draft.cleared.filter((slot) => !touchesGone(slot.targetKind, slot.targetId)),
    };
}

/**
 * A slot holds one route, so drawing one into an occupied slot replaces what
 * was there. The applier does the same thing when it writes, which is what
 * makes the canvas and the database agree about a slot nobody mentioned twice.
 */
export function drawRoute(draft: StructureDraft, route: DraftRoute): StructureDraft {
    const claimsSlot = (slot: DraftSlot) => slot.targetKind === route.targetKind && slot.targetId === route.targetId && slot.slot === route.slot;

    return {
        ...draft,
        routes: [...draft.routes.filter((existing) => !claimsSlot(existing)), route],
        cleared: draft.cleared.filter((slot) => !claimsSlot(slot)),
    };
}

export function clearSlot(draft: StructureDraft, slot: DraftSlot): StructureDraft {
    const claimsSlot = (candidate: DraftSlot) => candidate.targetKind === slot.targetKind && candidate.targetId === slot.targetId && candidate.slot === slot.slot;
    const drawnHere = draft.routes.some(claimsSlot);

    return {
        ...draft,
        routes: draft.routes.filter((route) => !claimsSlot(route)),
        /* A route the draft itself drew is taken back rather than written and
           deleted, so undoing a mistake leaves nothing behind to apply. */
        cleared: drawnHere ? draft.cleared : [...draft.cleared.filter((candidate) => !claimsSlot(candidate)), slot],
    };
}

/** Where everything hangs, so a plan can name the parents of what it changes. */
export type StructureIndex = {
    parentOf: Map<string, NodeRef>;
    nameOf: Map<string, string>;
};

export function indexStructure(division: TournamentDivisionOption | undefined, matches: Match[], draft: StructureDraft): StructureIndex {
    const parentOf = new Map<string, NodeRef>();
    const nameOf = new Map<string, string>();

    for (const phase of division?.phases ?? []) {
        nameOf.set(keyOf({ kind: "phase", id: phase.id }), phase.name);
        for (const pool of phase.phaseGroups ?? []) {
            parentOf.set(keyOf({ kind: "pool", id: pool.id }), { kind: "phase", id: phase.id });
            nameOf.set(keyOf({ kind: "pool", id: pool.id }), pool.name);
        }
    }
    for (const match of matches) {
        parentOf.set(keyOf({ kind: "match", id: match.id }), { kind: "pool", id: match.phaseGroupId });
        nameOf.set(keyOf({ kind: "match", id: match.id }), match.name);
    }
    for (const node of draft.added) {
        parentOf.set(keyOf(node), { kind: node.kind === "match" ? "pool" : "phase", id: node.parentId });
        nameOf.set(keyOf(node), node.name);
    }
    for (const entry of draft.renamed) {
        nameOf.set(keyOf(entry), entry.name);
    }

    return { parentOf, nameOf };
}

function descendantsOf(ref: NodeRef, draft: StructureDraft, tree: StructureIndex): NodeRef[] {
    const found: NodeRef[] = [];

    for (const [key, parent] of tree.parentOf) {
        if (!same(parent, ref)) {
            continue;
        }
        const [kind, id] = key.split(":");
        const child = { kind: kind as DraftKind, id: Number(id) };
        found.push(child, ...descendantsOf(child, draft, tree));
    }

    return found;
}

/**
 * The division as the draft would leave it.
 *
 * The canvas draws this and knows nothing about drafts: a pool waiting to be
 * written is a pool, with a name and a place in its column, and the only thing
 * that marks it out is that its id is negative and its key is in `pending`.
 */
export type ProjectedStructure = {
    division: TournamentDivisionOption | undefined;
    matches: Match[];
    /** The card keys of everything the draft would create. */
    pending: Set<string>;
};

export function projectStructure(division: TournamentDivisionOption | undefined, matches: Match[], draft: StructureDraft): ProjectedStructure {
    if (!division) {
        return { division, matches, pending: new Set() };
    }

    const removed = new Set(draft.removed.map(keyOf));
    const renamed = new Map(draft.renamed.map((entry) => [keyOf(entry), entry.name]));
    const named = <T extends { id: number; name: string }>(kind: DraftKind, row: T): T => ({ ...row, name: renamed.get(`${kind}:${row.id}`) ?? row.name });
    const kept = (kind: DraftKind, id: number) => !removed.has(`${kind}:${id}`);

    const rules = projectRules(division, matches, draft, removed);
    const addedOf = (kind: DraftKind, parentId: number) => draft.added.filter((node) => node.kind === kind && node.parentId === parentId);

    /* The count is arithmetic on the one the projection already carries rather
       than a length of the match list, which is not always loaded yet and would
       report an empty pool for a moment every time the page opened. */
    const countIn = (poolId: number) =>
        draft.added.filter((node) => node.kind === "match" && node.parentId === poolId).length -
        matches.filter((match) => match.phaseGroupId === poolId && removed.has(`match:${match.id}`)).length;

    const projectPool = (pool: PhaseGroup): PhaseGroup => ({
        ...named("pool", pool),
        matchCount: Math.max(pool.matchCount + countIn(pool.id), 0),
        advancementRules: rules.filter((rule) => rule.sourceKind === "phase_group" && rule.sourceId === pool.id),
    });

    /* A pool the draft added belongs at the end of its phase, whether that
       phase is one that is already there or one the same draft is adding. */
    const poolsOf = (phaseId: number, existing: PhaseGroup[]) => [
        ...existing.filter((pool) => kept("pool", pool.id)).map(projectPool),
        ...addedOf("pool", phaseId).map((node) => newPool(node, rules, countIn(node.id))),
    ];

    const phases: TournamentDivisionOptionPhase[] = [
        ...division.phases
            .filter((phase) => kept("phase", phase.id))
            .map((phase) => ({ ...named("phase", phase), phaseGroups: poolsOf(phase.id, phase.phaseGroups ?? []) })),
        ...addedOf("phase", division.id).map((node) => ({ id: node.id, name: node.name, matchCount: 0, phaseGroups: poolsOf(node.id, []) })),
    ].map((phase) => ({ ...phase, matchCount: (phase.phaseGroups ?? []).reduce((total, pool) => total + pool.matchCount, 0) }));

    return {
        division: { ...division, phases },
        matches: projectMatches(division, matches, draft, removed, renamed, rules),
        pending: new Set(draft.added.filter((node) => node.kind !== "phase").map((node) => `${node.kind}:${node.id}`)),
    };
}

function newPool(node: DraftAddition, rules: AdvancementRuleDto[], matchCount: number): PhaseGroup {
    return {
        id: node.id,
        name: node.name,
        displayIdentifier: null,
        bracketType: null,
        state: "pending",
        matchCount,
        progressedMatchCount: 0,
        pendingMatchCount: 0,
        advancementRules: rules.filter((rule) => rule.sourceKind === "phase_group" && rule.sourceId === node.id),
    } as PhaseGroup;
}

function projectMatches(
    division: TournamentDivisionOption,
    matches: Match[],
    draft: StructureDraft,
    removed: Set<string>,
    renamed: Map<string, string>,
    rules: AdvancementRuleDto[],
): Match[] {
    const rulesOf = (id: number) => rules.filter((rule) => touches(rule, "match", id));

    const existing = matches
        .filter((match) => !removed.has(`match:${match.id}`) && !removed.has(`pool:${match.phaseGroupId}`))
        .map((match) => ({ ...match, name: renamed.get(`match:${match.id}`) ?? match.name, advancementRules: rulesOf(match.id) }));

    const added = draft.added
        .filter((node) => node.kind === "match")
        .map(
            (node) =>
                ({
                    id: node.id,
                    name: node.name,
                    subtitle: "",
                    notes: "",
                    active: false,
                    entrants: [],
                    rounds: [],
                    tiebreaks: [],
                    phaseGroupId: node.parentId,
                    advancementRules: rulesOf(node.id),
                }) as unknown as Match,
        );

    /* The order a match is drawn in is the order it was made in, and a new one
       belongs at the end of its pool rather than at the end of the division. */
    const poolOrder = division.phases.flatMap((phase) => (phase.phaseGroups ?? []).map((pool) => pool.id));

    return [...existing, ...added].sort((left, right) => poolOrder.indexOf(left.phaseGroupId) - poolOrder.indexOf(right.phaseGroupId));
}

function touches(rule: AdvancementRuleDto, kind: RoutableKind, id: number): boolean {
    const wanted = kind === "pool" ? "phase_group" : "match";

    return (rule.sourceKind === wanted && rule.sourceId === id) || (rule.targetKind === wanted && rule.targetId === id);
}

/**
 * Every rule the division would hold: the ones already written, less the ones
 * the draft takes away or displaces, plus the ones it draws.
 *
 * They are worked out as one flat set and handed back out to the pools and the
 * matches afterwards, because a rule belongs to both of its ends and keeping
 * two lists in step by hand is how they stop agreeing.
 */
function projectRules(
    division: TournamentDivisionOption,
    matches: Match[],
    draft: StructureDraft,
    removed: Set<string>,
): AdvancementRuleDto[] {
    const existing = new Map<string, AdvancementRuleDto>();
    for (const pool of division.phases.flatMap((phase) => phase.phaseGroups ?? [])) {
        for (const rule of pool.advancementRules ?? []) {
            existing.set(`${rule.targetKind}:${rule.targetId}:${rule.targetSlot}`, rule);
        }
    }
    for (const match of matches) {
        for (const rule of match.advancementRules ?? []) {
            existing.set(`${rule.targetKind}:${rule.targetId}:${rule.targetSlot}`, rule);
        }
    }

    const isGone = (kind: AdvancementRuleDto["sourceKind"], id: number) => removed.has(`${kind === "match" ? "match" : "pool"}:${id}`);
    for (const [key, rule] of existing) {
        if (isGone(rule.sourceKind, rule.sourceId) || isGone(rule.targetKind, rule.targetId)) {
            existing.delete(key);
        }
    }
    for (const slot of draft.cleared) {
        existing.delete(slotKey(slot.targetKind, slot.targetId, slot.slot));
    }

    const nameOf = namesOf(division, matches, draft);
    for (const [index, route] of draft.routes.entries()) {
        existing.set(slotKey(route.targetKind, route.targetId, route.slot), {
            id: -(index + 1),
            sourceKind: route.sourceKind === "pool" ? "phase_group" : "match",
            sourceId: route.sourceId,
            sourceName: nameOf(route.sourceKind, route.sourceId),
            sourcePlacement: route.placement,
            targetKind: route.targetKind === "pool" ? "phase_group" : "match",
            targetId: route.targetId,
            targetName: nameOf(route.targetKind, route.targetId),
            targetSlot: route.slot,
        });
    }

    return [...existing.values()];
}

function slotKey(kind: RoutableKind, id: number, slot: number): string {
    return `${kind === "pool" ? "phase_group" : "match"}:${id}:${slot}`;
}

function namesOf(division: TournamentDivisionOption, matches: Match[], draft: StructureDraft): (kind: RoutableKind, id: number) => string {
    const index = indexStructure(division, matches, draft);

    return (kind, id) => index.nameOf.get(`${kind}:${id}`) ?? "elsewhere";
}

/**
 * The draft as the one plan that writes it.
 *
 * Every node the plan changes carries the parents it hangs from, as links, so
 * the applier can put a new pool inside a phase that is itself new and a route
 * between two matches that will not exist until the same transaction makes
 * them. Nothing is sent twice: a node is added the first time it is named.
 *
 * The version it is written against is the one the page is looking at now, not
 * one the draft remembered: the draft is what somebody means to do, and when
 * they mean to do it is when it is checked.
 */
export function toStructurePlan(draft: StructureDraft, divisionName: string, tree: StructureIndex, structureVersion: number): StructurePlan {
    const nodes = new Map<string, PlanNode>();
    const divisionLocalId = `division:${draft.divisionId}`;

    nodes.set(divisionLocalId, { localId: divisionLocalId, kind: "division", action: "link", localRowId: draft.divisionId, name: divisionName });

    function ensure(ref: NodeRef): string {
        const localId = keyOf(ref);
        if (nodes.has(localId)) {
            return localId;
        }

        const parent = tree.parentOf.get(localId);
        const parentLocalId = parent ? ensure(parent) : divisionLocalId;
        const name = tree.nameOf.get(localId) ?? "";
        const kind = planKindOf(ref.kind);

        if (isPending(ref.id)) {
            nodes.set(localId, { localId, kind, parentLocalId, action: "create", name });
        } else {
            nodes.set(localId, { localId, kind, parentLocalId, action: "link", localRowId: ref.id, name });
        }

        return localId;
    }

    for (const node of draft.added) {
        ensure(node);
    }
    for (const entry of draft.renamed) {
        ensure(entry);
    }
    for (const route of draft.routes) {
        ensure({ kind: route.sourceKind, id: route.sourceId });
        ensure({ kind: route.targetKind, id: route.targetId });
    }
    for (const slot of draft.cleared) {
        ensure({ kind: slot.targetKind, id: slot.targetId });
    }
    /* Removals come last so a row that something else in the plan names is
       already a link when this asks for it, and is then turned into a removal. */
    for (const ref of draft.removed) {
        const localId = ensure(ref);
        nodes.set(localId, { ...nodes.get(localId)!, action: "remove" });
    }

    return {
        tournamentId: draft.tournamentId,
        source: { kind: "manual" },
        basedOn: [{ divisionId: draft.divisionId, structureVersion }],
        nodes: [...nodes.values()],
        routes: draft.routes.map((route) => ({
            sourceLocalId: keyOf({ kind: route.sourceKind, id: route.sourceId }),
            sourcePlacement: route.placement,
            targetLocalId: keyOf({ kind: route.targetKind, id: route.targetId }),
            targetSlot: route.slot,
        })),
        clearedSlots: draft.cleared.map((slot) => ({ targetLocalId: keyOf({ kind: slot.targetKind, id: slot.targetId }), targetSlot: slot.slot })),
    };
}

function planKindOf(kind: DraftKind): PlanNode["kind"] {
    if (kind === "pool") {
        return "phaseGroup";
    }

    return kind;
}
