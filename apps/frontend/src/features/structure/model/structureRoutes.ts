import type { AdvancementRuleDto } from "@tournament-manager/contracts";
import type { Match } from "@/features/match/model/types";
import type { TournamentDivisionOption } from "@/features/tournament/model/types";
import type { RoutableKind } from "@/features/structure/model/structureDraft";

/**
 * Every route a division holds, and which end of one a node is on.
 *
 * A rule is written once and read from both of its ends: a pool carries the
 * rules that leave it, a match carries the rules that leave it and the rules
 * that fill it. The panel wants a node's routes both ways round, so they are
 * gathered into one set here and asked about by node, rather than each surface
 * flattening the tree again and disagreeing about what it found.
 */

export type NodeRoutes = {
    /** Routes that fill this node, in slot order. */
    incoming: AdvancementRuleDto[];
    /** Routes that leave it, in placement order. */
    outgoing: AdvancementRuleDto[];
};

export function collectRoutes(division: TournamentDivisionOption | undefined, matches: Match[]): AdvancementRuleDto[] {
    const byIdentity = new Map<string, AdvancementRuleDto>();
    const carried = [
        ...(division?.phases ?? []).flatMap((phase) => (phase.phaseGroups ?? []).flatMap((pool) => pool.advancementRules ?? [])),
        ...matches.flatMap((match) => match.advancementRules ?? []),
    ];

    /* The same rule reaches this from the pool it leaves and the match it fills,
       and its id is not a key: a route the draft drew has no row behind it. */
    for (const rule of carried) {
        byIdentity.set(`${rule.targetKind}:${rule.targetId}:${rule.targetSlot}`, rule);
    }

    return [...byIdentity.values()];
}

export function routesOf(routes: AdvancementRuleDto[], kind: RoutableKind, id: number): NodeRoutes {
    const wanted = kind === "pool" ? "phase_group" : "match";

    return {
        incoming: routes.filter((rule) => rule.targetKind === wanted && rule.targetId === id).sort((left, right) => left.targetSlot - right.targetSlot),
        outgoing: routes
            .filter((rule) => rule.sourceKind === wanted && rule.sourceId === id)
            .sort((left, right) => left.sourcePlacement - right.sourcePlacement),
    };
}
