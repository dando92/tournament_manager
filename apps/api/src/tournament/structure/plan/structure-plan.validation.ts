import type { PlanAction, PlanNode, PlanNodeKind, StructurePlan } from '@tournament-manager/contracts';

/**
 * Whether a plan can be written at all.
 *
 * A plan arrives from a browser, so every guarantee the generators used to give
 * by construction has to be checked here instead. Nothing in this file reads
 * the database: it answers what is wrong with the graph itself, and the store
 * answers what is wrong with the rows it names.
 *
 * Every reason is collected rather than thrown at the first one, because a
 * caller fixing a plan wants the list and not a sequence of round trips.
 */

/** What may hold what. A plan that disagrees with this is not a structure. */
const PARENT_OF: Record<PlanNodeKind, PlanNodeKind | null> = {
    division: null,
    phase: 'division',
    phaseGroup: 'phase',
    match: 'phaseGroup',
    participant: null,
    entrant: 'division',
};

/** The kinds a route may join. A pool advances; a participant does not. */
const ROUTABLE: PlanNodeKind[] = ['phaseGroup', 'match'];

/** The actions that leave a row standing when the plan has been written. */
const SURVIVES: PlanAction[] = ['create', 'link'];

export function validateStructurePlan(plan: StructurePlan): string[] {
    const errors: string[] = [];
    const byLocalId = new Map<string, PlanNode>();

    for (const node of plan.nodes) {
        if (byLocalId.has(node.localId)) {
            errors.push(`Two nodes share the local id ${node.localId}.`);
            continue;
        }
        byLocalId.set(node.localId, node);
    }

    for (const node of plan.nodes) {
        errors.push(...validateNode(node, byLocalId));
    }

    errors.push(...validateRoutes(plan, byLocalId));
    errors.push(...validateClearedSlots(plan, byLocalId));

    return errors;
}

function validateNode(node: PlanNode, byLocalId: Map<string, PlanNode>): string[] {
    const errors: string[] = [];

    /* A name is what a plan writes, so it is asked for where it will be written.
       A linked node carries one because renaming is an edit to the link rather
       than an action of its own; a skipped or removed row is not being named. */
    if (!node.name?.trim() && SURVIVES.includes(node.action)) {
        errors.push(`${node.localId} has no name.`);
    }

    if (node.action !== 'create' && node.action !== 'skip' && !node.localRowId) {
        errors.push(`${node.localId} ${node.action}s nothing: it names no row.`);
    }

    if (node.action === 'create' && node.localRowId) {
        errors.push(`${node.localId} both creates and names an existing row.`);
    }

    /* Only a match is played, so only a match has people in it and songs to
       play. A pool carrying either is a plan that means something else. */
    if (node.kind !== 'match' && (node.entrantRowIds || node.songIds)) {
        errors.push(`${node.localId} is a ${node.kind} and cannot hold players or songs.`);
    }

    const expectedParent = PARENT_OF[node.kind];
    if (!node.parentLocalId) {
        /* A division hangs off the tournament, and so does a participant, which
           belongs to the tournament's roster rather than to any structure. */
        if (expectedParent) {
            errors.push(`${node.localId} is a ${node.kind} and has nothing to hang from.`);
        }

        return errors;
    }

    const parent = byLocalId.get(node.parentLocalId);
    if (!parent) {
        errors.push(`${node.localId} hangs from ${node.parentLocalId}, which the plan does not carry.`);

        return errors;
    }

    if (parent.kind !== expectedParent) {
        errors.push(`${node.localId} is a ${node.kind} and cannot hang from a ${parent.kind}.`);
    }

    if (!SURVIVES.includes(parent.action) && SURVIVES.includes(node.action)) {
        errors.push(`${node.localId} would be written into ${parent.localId}, which the plan does not leave standing.`);
    }

    return errors;
}

function validateRoutes(plan: StructurePlan, byLocalId: Map<string, PlanNode>): string[] {
    const errors: string[] = [];
    const claimed = new Set<string>();

    for (const route of plan.routes) {
        const source = byLocalId.get(route.sourceLocalId);
        const target = byLocalId.get(route.targetLocalId);

        if (!source || !target) {
            errors.push(`A route joins ${route.sourceLocalId} to ${route.targetLocalId}, which the plan does not carry.`);
            continue;
        }
        if (source.localId === target.localId) {
            errors.push(`${source.localId} cannot advance into itself.`);
            continue;
        }
        if (!ROUTABLE.includes(source.kind) || !ROUTABLE.includes(target.kind)) {
            errors.push(`A route joins a ${source.kind} to a ${target.kind}, and only pools and matches advance.`);
            continue;
        }
        if (!SURVIVES.includes(source.action) || !SURVIVES.includes(target.action)) {
            errors.push(`A route joins ${source.localId} to ${target.localId}, and the plan does not leave one of them standing.`);
            continue;
        }
        if (route.sourcePlacement < 1) {
            errors.push(`A route out of ${source.localId} names place ${route.sourcePlacement}, and places start at one.`);
        }
        if (route.targetSlot < 1) {
            errors.push(`A route into ${target.localId} names slot ${route.targetSlot}, and slots start at one.`);
        }

        const key = `${route.targetLocalId}#${route.targetSlot}`;
        if (claimed.has(key)) {
            errors.push(`Two routes claim slot ${route.targetSlot} of ${target.localId}.`);
        }
        claimed.add(key);
    }

    return errors;
}

/**
 * The slots a plan empties, which are the routes it takes away.
 *
 * Emptying a slot and filling it in the same plan is a contradiction rather
 * than an order of operations, so it is refused instead of resolved: whichever
 * way the applier ran them, one of the two intentions would be silently lost.
 */
function validateClearedSlots(plan: StructurePlan, byLocalId: Map<string, PlanNode>): string[] {
    const errors: string[] = [];
    const filled = new Set(plan.routes.map((route) => `${route.targetLocalId}#${route.targetSlot}`));

    for (const slot of plan.clearedSlots ?? []) {
        const target = byLocalId.get(slot.targetLocalId);
        if (!target) {
            errors.push(`A slot is emptied on ${slot.targetLocalId}, which the plan does not carry.`);
            continue;
        }
        if (!ROUTABLE.includes(target.kind)) {
            errors.push(`A slot is emptied on ${target.localId}, and only pools and matches have slots.`);
            continue;
        }
        if (slot.targetSlot < 1) {
            errors.push(`A slot emptied on ${target.localId} is numbered ${slot.targetSlot}, and slots start at one.`);
            continue;
        }
        if (filled.has(`${slot.targetLocalId}#${slot.targetSlot}`)) {
            errors.push(`Slot ${slot.targetSlot} of ${target.localId} is both emptied and filled.`);
        }
    }

    return errors;
}

/**
 * The order rows have to be written in.
 *
 * A node is written after whatever it hangs from, so a plan carrying a division,
 * its phases and their matches lands in one pass without anybody sorting it by
 * hand. A cycle cannot arise from a tree, but a plan is client-supplied, so one
 * is reported rather than looped over.
 */
export function orderedForWriting(plan: StructurePlan): { nodes: PlanNode[]; errors: string[] } {
    const byLocalId = new Map(plan.nodes.map((node) => [node.localId, node]));
    const ordered: PlanNode[] = [];
    const state = new Map<string, 'visiting' | 'done'>();
    const errors: string[] = [];

    function visit(node: PlanNode): void {
        const seen = state.get(node.localId);
        if (seen === 'done') {
            return;
        }
        if (seen === 'visiting') {
            errors.push(`${node.localId} hangs from itself, through its parents.`);

            return;
        }

        state.set(node.localId, 'visiting');
        const parent = node.parentLocalId ? byLocalId.get(node.parentLocalId) : undefined;
        if (parent) {
            visit(parent);
        }
        state.set(node.localId, 'done');
        ordered.push(node);
    }

    for (const node of plan.nodes) {
        visit(node);
    }

    return { nodes: ordered, errors };
}
