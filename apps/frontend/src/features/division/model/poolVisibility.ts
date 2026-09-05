import type { PhaseGroup } from "@/features/division/model/types";
import { phaseGroupLabel } from "@/features/division/model/phaseGroupLabel";

/**
 * When a pool is a node of its own and when it is not.
 *
 * Every phase holds at least one pool, so a phase with a single one has nothing
 * to say by drawing it: the node would repeat the phase under a name nobody
 * chose. That pool is implicit — it exists, it owns the matches, the seeding
 * and the advancement rules, it is simply not shown.
 *
 * The rule lives here because four places have to answer it identically at the
 * same instant: the tree, the breadcrumb, the destination picker of a new
 * match, and the headers of the match list. A pool hidden in one of them and
 * offered in another is the bug this file exists to prevent.
 */

/** The least a phase has to carry for the rule to apply to it. */
type PhaseWithPools = {
    name: string;
    phaseGroups?: PhaseGroup[];
};

/** The pool a phase does not draw, or nothing when its pools are its own nodes. */
export function implicitPool(phase: PhaseWithPools | undefined | null): PhaseGroup | undefined {
    const pools = phase?.phaseGroups ?? [];

    return pools.length === 1 ? pools[0] : undefined;
}

export function poolsAreVisible(phase: PhaseWithPools | undefined | null): boolean {
    return (phase?.phaseGroups?.length ?? 0) > 1;
}

/**
 * What to call a pool in front of somebody: its own name once the phase draws
 * its pools, and the phase's name while it does not. An implicit pool is the
 * phase as far as anybody reading the screen is concerned.
 */
export function poolLabelIn(phase: PhaseWithPools | undefined | null, pool: PhaseGroup): string {
    if (phase && implicitPool(phase)?.id === pool.id) return phase.name;

    return phaseGroupLabel(pool);
}

/** What the pool a new phase brings with it is called, which the phase draws as itself. */
export const FIRST_POOL_NAME = "Pool";

/** The name a new pool is offered under: the next number nobody has taken. */
export function nextPoolName(phase: PhaseWithPools | undefined | null): string {
    const taken = new Set((phase?.phaseGroups ?? []).map((pool) => phaseGroupLabel(pool)));
    let number = (phase?.phaseGroups?.length ?? 0) + 1;
    while (taken.has(`Pool ${number}`)) number += 1;

    return `Pool ${number}`;
}
