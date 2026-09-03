import type { PlanNode, PlanRoute, StructurePlan } from '@tournament-manager/contracts';

import { orderedForWriting, validateStructurePlan } from '@tournament/structure/plan/structure-plan.validation';

/**
 * A plan arrives from a browser, so every guarantee the generators used to give
 * by construction is checked here instead. These are the ways a plan can be a
 * graph but not a structure.
 */

function node(partial: Partial<PlanNode> & Pick<PlanNode, 'localId' | 'kind'>): PlanNode {
    return { action: 'create', name: partial.localId, ...partial };
}

function plan(nodes: PlanNode[], routes: PlanRoute[] = []): StructurePlan {
    return { tournamentId: 1, source: { kind: 'manual' }, basedOn: [], nodes, routes };
}

const division = node({ localId: 'd', kind: 'division', name: 'Open' });
const phase = node({ localId: 'p', kind: 'phase', parentLocalId: 'd', name: 'Qualifiers' });
const pool = node({ localId: 'g', kind: 'phaseGroup', parentLocalId: 'p', name: 'Pool A' });
const match = node({ localId: 'm', kind: 'match', parentLocalId: 'g', name: 'Round 1' });

describe('validateStructurePlan', () => {
    it('accepts a division with a phase, a pool and a match under it', () => {
        expect(validateStructurePlan(plan([division, phase, pool, match]))).toEqual([]);
    });

    it('refuses two nodes under one local id', () => {
        const errors = validateStructurePlan(plan([division, node({ localId: 'd', kind: 'division', name: 'Again' })]));

        expect(errors).toEqual([expect.stringContaining('share the local id d')]);
    });

    it('refuses a node that hangs from something the plan does not carry', () => {
        const errors = validateStructurePlan(plan([node({ localId: 'p', kind: 'phase', parentLocalId: 'nowhere' })]));

        expect(errors).toEqual([expect.stringContaining('which the plan does not carry')]);
    });

    it('refuses a pool hanging from a division', () => {
        const errors = validateStructurePlan(plan([division, node({ localId: 'g', kind: 'phaseGroup', parentLocalId: 'd' })]));

        expect(errors).toEqual([expect.stringContaining('cannot hang from a division')]);
    });

    it('refuses a phase with nothing to hang from', () => {
        const errors = validateStructurePlan(plan([node({ localId: 'p', kind: 'phase' })]));

        expect(errors).toEqual([expect.stringContaining('has nothing to hang from')]);
    });

    /* A linked node is the row it names, so it has to name one; and a created
       node cannot also claim to be a row that is already there. */
    it('refuses a link with no row and a creation with one', () => {
        const errors = validateStructurePlan(
            plan([
                node({ localId: 'a', kind: 'division', action: 'link' }),
                node({ localId: 'b', kind: 'division', action: 'create', localRowId: 7 }),
            ]),
        );

        expect(errors).toEqual([expect.stringContaining('links to nothing'), expect.stringContaining('both creates and names')]);
    });

    it('refuses writing into something the plan leaves out', () => {
        const errors = validateStructurePlan(plan([{ ...division, action: 'skip' }, phase]));

        expect(errors).toEqual([expect.stringContaining('which the plan leaves out')]);
    });

    it('refuses a match that advances into itself', () => {
        const errors = validateStructurePlan(
            plan([division, phase, pool, match], [{ sourceLocalId: 'm', sourcePlacement: 1, targetLocalId: 'm', targetSlot: 1 }]),
        );

        expect(errors).toEqual([expect.stringContaining('cannot advance into itself')]);
    });

    it('refuses two routes claiming one slot', () => {
        const second = node({ localId: 'm2', kind: 'match', parentLocalId: 'g', name: 'Round 2' });
        const target = node({ localId: 'm3', kind: 'match', parentLocalId: 'g', name: 'Final' });
        const errors = validateStructurePlan(
            plan(
                [division, phase, pool, match, second, target],
                [
                    { sourceLocalId: 'm', sourcePlacement: 1, targetLocalId: 'm3', targetSlot: 1 },
                    { sourceLocalId: 'm2', sourcePlacement: 1, targetLocalId: 'm3', targetSlot: 1 },
                ],
            ),
        );

        expect(errors).toEqual([expect.stringContaining('Two routes claim slot 1')]);
    });

    it('refuses a route that joins something which does not advance', () => {
        const errors = validateStructurePlan(
            plan([division, phase, pool, match], [{ sourceLocalId: 'd', sourcePlacement: 1, targetLocalId: 'm', targetSlot: 1 }]),
        );

        expect(errors).toEqual([expect.stringContaining('only pools and matches advance')]);
    });

    it('refuses a place or a slot below one', () => {
        const second = node({ localId: 'm2', kind: 'match', parentLocalId: 'g' });
        const errors = validateStructurePlan(
            plan([division, phase, pool, match, second], [{ sourceLocalId: 'm', sourcePlacement: 0, targetLocalId: 'm2', targetSlot: 0 }]),
        );

        expect(errors).toEqual([expect.stringContaining('places start at one'), expect.stringContaining('slots start at one')]);
    });
});

describe('orderedForWriting', () => {
    it('writes a node after whatever it hangs from, whatever order it arrived in', () => {
        const ordering = orderedForWriting(plan([match, pool, phase, division]));

        expect(ordering.errors).toEqual([]);
        expect(ordering.nodes.map((candidate) => candidate.localId)).toEqual(['d', 'p', 'g', 'm']);
    });

    it('reports a parent cycle instead of following it', () => {
        const ordering = orderedForWriting(
            plan([node({ localId: 'a', kind: 'phase', parentLocalId: 'b' }), node({ localId: 'b', kind: 'phase', parentLocalId: 'a' })]),
        );

        expect(ordering.errors).toEqual([expect.stringContaining('hangs from itself')]);
    });
});
