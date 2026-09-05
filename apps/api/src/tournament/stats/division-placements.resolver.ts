import type { AdvancementCompetitionKind, DivisionPlacementRowDto, DivisionPlacementsDto, EntrantStatus } from '@tournament-manager/contracts';

/**
 * One competition of a division, as the advancement graph sees it.
 *
 * `placements` is what it settled on, ties included, and is empty while it has
 * settled nothing. `entrantIds` is everybody it held either way, so somebody a
 * bye carried through still has a node to belong to.
 */
export type PlacementCompetition = {
    kind: AdvancementCompetitionKind;
    id: number;
    name: string;
    /** The pool a match belongs to. Null on a pool, and on a match without one. */
    phaseGroupId: number | null;
    decided: boolean;
    entrantIds: number[];
    placements: Array<{ entrantId: number; placement: number }>;
};

export type PlacementEdge = {
    sourceKind: AdvancementCompetitionKind;
    sourceId: number;
    targetKind: AdvancementCompetitionKind;
    targetId: number;
};

export type PlacementEntrant = {
    entrantId: number;
    entrantName: string;
    playerId: number | null;
    playerName: string | null;
    status: EntrantStatus;
    seedNum: number | null;
    points: number;
    songsPlayed: number;
    averagePercentage: number | null;
};

export type DivisionPlacementInput = {
    divisionId: number;
    divisionName: string;
    competitions: PlacementCompetition[];
    edges: PlacementEdge[];
    entrants: PlacementEntrant[];
};

type NodeKey = string;

/** Where one entrant's run ended, before the band is counted out. */
type ExitNode = {
    node: PlacementCompetition;
    depth: number;
    placement: number;
};

type Exit = ExitNode & { entrant: PlacementEntrant };

/**
 * The order a division finished in, read back off its advancement graph.
 *
 * Two questions decide everything. The first is which competitions actually
 * place people: a pool whose matches feed one another is a bracket, and there
 * the matches place and the pool is only a container; a pool whose matches are
 * unconnected placed people itself, by the totals its matches gave them. The
 * second is how far each competition sits from the end, measured as the longest
 * path along the rules to a competition nothing leaves.
 *
 * An entrant's run ended at the competition closest to the end that held them,
 * and their place in it says the rest. Everybody who ended at the same distance
 * in the same position shares a placement, because the evidence that would order
 * them was taken on different songs against different people — the same reason a
 * match separates its own tie and this does not.
 */
export function resolveDivisionPlacements(input: DivisionPlacementInput): DivisionPlacementsDto {
    const graph = buildGraph(input.competitions, input.edges);
    const exits = collectExits(input.entrants, graph);

    return {
        divisionId: input.divisionId,
        divisionName: input.divisionName,
        complete: isComplete(input.competitions),
        endings: graph.nodes.filter((node) => (graph.outgoing.get(keyOf(node)) ?? new Set()).size === 0).length,
        rows: bandRows(exits),
    };
}

type Graph = {
    nodes: PlacementCompetition[];
    outgoing: Map<NodeKey, Set<NodeKey>>;
    depths: Map<NodeKey, number>;
};

function keyOf(competition: Pick<PlacementCompetition, 'kind' | 'id'>): NodeKey {
    return `${competition.kind}:${competition.id}`;
}

function buildGraph(competitions: PlacementCompetition[], edges: PlacementEdge[]): Graph {
    const poolOfMatch = new Map<number, number>();
    const matchesOfPool = new Map<number, number[]>();

    for (const competition of competitions) {
        if (competition.kind !== 'match' || competition.phaseGroupId === null) {
            continue;
        }
        poolOfMatch.set(competition.id, competition.phaseGroupId);
        matchesOfPool.set(competition.phaseGroupId, [...(matchesOfPool.get(competition.phaseGroupId) ?? []), competition.id]);
    }

    const bracketPools = findBracketPools(edges, poolOfMatch);
    const nodes = competitions.filter((competition) =>
        competition.kind === 'match'
            ? competition.phaseGroupId === null || bracketPools.has(competition.phaseGroupId)
            : !bracketPools.has(competition.id),
    );
    const nodeKeys = new Set(nodes.map(keyOf));

    /**
     * A rule names a competition that may not be one of the nodes. A match of a
     * pool that places people itself is answered by that pool, and a pool whose
     * matches place is answered by all of them: arriving there means the whole
     * bracket is still ahead.
     */
    const resolve = (kind: AdvancementCompetitionKind, id: number): NodeKey[] => {
        if (nodeKeys.has(keyOf({ kind, id }))) {
            return [keyOf({ kind, id })];
        }
        if (kind === 'match') {
            const pool = poolOfMatch.get(id);

            return pool === undefined ? [] : [keyOf({ kind: 'phase_group', id: pool })];
        }

        return (matchesOfPool.get(id) ?? []).map((matchId) => keyOf({ kind: 'match', id: matchId }));
    };

    const outgoing = new Map<NodeKey, Set<NodeKey>>(nodes.map((node) => [keyOf(node), new Set<NodeKey>()]));
    for (const edge of edges) {
        for (const from of resolve(edge.sourceKind, edge.sourceId)) {
            for (const to of resolve(edge.targetKind, edge.targetId)) {
                if (from !== to) {
                    outgoing.get(from)?.add(to);
                }
            }
        }
    }

    return { nodes, outgoing, depths: measureDepths(nodes, outgoing) };
}

/** A pool whose own matches feed one another decides through them, not itself. */
function findBracketPools(edges: PlacementEdge[], poolOfMatch: Map<number, number>): Set<number> {
    const pools = new Set<number>();

    for (const edge of edges) {
        if (edge.sourceKind !== 'match' || edge.targetKind !== 'match') {
            continue;
        }
        const pool = poolOfMatch.get(edge.sourceId);
        if (pool !== undefined && pool === poolOfMatch.get(edge.targetId)) {
            pools.add(pool);
        }
    }

    return pools;
}

/**
 * How far each node sits from the end: the longest path of rules leaving it.
 *
 * Nothing stops an advancement rule from closing a loop — the validation refuses
 * a source that targets itself and nothing more — so a node met twice on one
 * walk contributes nothing rather than recursing. That makes a malformed graph
 * answer something instead of never answering; it does not make the answer
 * meaningful, and the shape is a functional question of its own.
 */
function measureDepths(nodes: PlacementCompetition[], outgoing: Map<NodeKey, Set<NodeKey>>): Map<NodeKey, number> {
    const depths = new Map<NodeKey, number>();

    const walk = (key: NodeKey, visiting: Set<NodeKey>): number => {
        const known = depths.get(key);
        if (known !== undefined) {
            return known;
        }
        if (visiting.has(key)) {
            return 0;
        }

        visiting.add(key);
        let depth = 0;
        for (const next of outgoing.get(key) ?? []) {
            depth = Math.max(depth, 1 + walk(next, visiting));
        }
        visiting.delete(key);
        depths.set(key, depth);

        return depth;
    };

    for (const node of nodes) {
        walk(keyOf(node), new Set());
    }

    return depths;
}

/**
 * The node each entrant did not get past, and where they stood in it.
 *
 * Somebody a node held without placing — a bye, or a competition still open —
 * sits behind everyone it did place, which keeps them inside the same band
 * rather than inventing a position for them.
 */
function collectExits(entrants: PlacementEntrant[], graph: Graph): Exit[] {
    const byEntrant = new Map<number, ExitNode>();

    for (const node of graph.nodes) {
        const depth = graph.depths.get(keyOf(node)) ?? 0;
        const placements = new Map(node.placements.map((entry) => [entry.entrantId, entry.placement]));

        for (const entrantId of node.entrantIds) {
            const candidate = { node, depth, placement: placements.get(entrantId) ?? node.entrantIds.length + 1 };
            const held = byEntrant.get(entrantId);
            if (!held || isCloserToTheEnd(candidate, held)) {
                byEntrant.set(entrantId, candidate);
            }
        }
    }

    return entrants
        .map((entrant) => {
            const exit = byEntrant.get(entrant.entrantId);

            return exit ? { ...exit, entrant } : null;
        })
        .filter((exit): exit is Exit => exit !== null);
}

function isCloserToTheEnd(candidate: ExitNode, held: ExitNode): boolean {
    return (
        candidate.depth < held.depth ||
        (candidate.depth === held.depth && candidate.placement < held.placement) ||
        (candidate.depth === held.depth && candidate.placement === held.placement && candidate.node.id < held.node.id)
    );
}

/**
 * The exits counted out into placements.
 *
 * Everybody who left at the same distance from the end, in the same position,
 * is one band: it takes as many places as it holds people, and the next band
 * starts after all of them.
 */
function bandRows(exits: Exit[]): DivisionPlacementRowDto[] {
    const ordered = [...exits].sort(
        (left, right) =>
            left.depth - right.depth ||
            left.placement - right.placement ||
            left.entrant.entrantName.localeCompare(right.entrant.entrantName) ||
            left.entrant.entrantId - right.entrant.entrantId,
    );

    const rows: DivisionPlacementRowDto[] = [];
    let index = 0;

    while (index < ordered.length) {
        let end = index + 1;
        while (end < ordered.length && ordered[end].depth === ordered[index].depth && ordered[end].placement === ordered[index].placement) {
            end += 1;
        }

        for (const exit of ordered.slice(index, end)) {
            rows.push({
                entrantId: exit.entrant.entrantId,
                entrantName: exit.entrant.entrantName,
                playerId: exit.entrant.playerId,
                playerName: exit.entrant.playerName,
                status: exit.entrant.status,
                seedNum: exit.entrant.seedNum,
                placement: index + 1,
                sharedThrough: end,
                exitKind: exit.node.kind,
                exitId: exit.node.id,
                exitName: exit.node.name,
                points: exit.entrant.points,
                songsPlayed: exit.entrant.songsPlayed,
                averagePercentage: exit.entrant.averagePercentage,
            });
        }

        index = end;
    }

    return rows;
}

/** A division is finished when every match of it has been decided, and it has one. */
function isComplete(competitions: PlacementCompetition[]): boolean {
    const matches = competitions.filter((competition) => competition.kind === 'match');

    return matches.length > 0 && matches.every((match) => match.decided);
}
