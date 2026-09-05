import type { AdvancementRuleDto, MatchPlacementTieDto, MatchResultEntryDto } from "@tournament-manager/contracts";

/**
 * What placement resolution needs of a rule: where it leaves from and where it
 * goes. The names the projection resolves are for a reader, so asking for the
 * whole DTO here would force every caller holding entities to carry them.
 */
export type AdvancementRouting = Pick<AdvancementRuleDto, "sourceKind" | "sourceId" | "sourcePlacement" | "targetKind" | "targetId" | "targetSlot">;

export type TiebreakPlacementInput = {
    id: number;
    sequence: number;
    invalidated: boolean;
    complete: boolean;
    entries: Array<{
        playerId: number;
        value: number | null;
        isFailed: boolean | null;
    }>;
};

/**
 * One player's total, with what they cleared behind it.
 *
 * The average is the mean of the runs they did not fail, and is absent whenever
 * there is nothing to average — a hand-scored match, or one somebody failed
 * throughout. Absent is not zero: it is the word for evidence that cannot
 * separate anybody.
 */
export type PlacementPointEntry = {
    playerId: number;
    points: number;
    averagePercentage?: number | null;
};

export type PlacementResolution = {
    entries: MatchResultEntryDto[];
    ambiguousTies: MatchPlacementTieDto[];
};

type PlacementGroup = MatchResultEntryDto[];

/**
 * Splits equal point groups with completed tiebreak attempts, in sequence.
 *
 * Attempts apply to a whole unresolved group. Their values only partition that
 * group; they never replace or add to its match points.
 */
export function resolvePlacements(
    pointEntries: PlacementPointEntry[],
    tiebreaks: TiebreakPlacementInput[],
    advancementRules: AdvancementRouting[],
): PlacementResolution {
    const averages = new Map(pointEntries.map((entry) => [entry.playerId, entry.averagePercentage ?? null]));
    let groups = pointGroups(pointEntries);

    for (const tiebreak of [...tiebreaks].sort((left, right) => left.sequence - right.sequence || left.id - right.id)) {
        if (tiebreak.invalidated || !tiebreak.complete) continue;

        const groupIndex = groups.findIndex((group) => samePlayers(group, tiebreak.entries));
        if (groupIndex < 0) continue;

        groups = [
            ...groups.slice(0, groupIndex),
            ...splitGroup(groups[groupIndex], tiebreak),
            ...groups.slice(groupIndex + 1),
        ];
    }

    return materialize(groups, advancementRules, averages);
}

function pointGroups(entries: PlacementPointEntry[]): PlacementGroup[] {
    const ordered = [...entries].sort((left, right) => right.points - left.points || left.playerId - right.playerId);
    const groups: PlacementGroup[] = [];

    for (const entry of ordered) {
        const last = groups.at(-1);
        const placed = { playerId: entry.playerId, points: entry.points, placement: 0 };
        if (last?.[0]?.points === entry.points) {
            last.push(placed);
        } else {
            groups.push([placed]);
        }
    }

    return groups;
}

function samePlayers(group: PlacementGroup, entries: TiebreakPlacementInput["entries"]): boolean {
    if (group.length !== entries.length) return false;

    const players = new Set(group.map((entry) => entry.playerId));
    return entries.every((entry) => players.has(entry.playerId));
}

function splitGroup(group: PlacementGroup, tiebreak: TiebreakPlacementInput): PlacementGroup[] {
    const values = new Map(tiebreak.entries.map((entry) => [entry.playerId, entry]));
    const ordered = [...group].sort((left, right) => compareEvidence(values.get(left.playerId), values.get(right.playerId)) || left.playerId - right.playerId);
    const groups: PlacementGroup[] = [];

    for (const entry of ordered) {
        const last = groups.at(-1);
        const previous = last ? values.get(last[0].playerId) : null;
        const current = values.get(entry.playerId);
        if (last && compareEvidence(previous, current) === 0) last.push(entry);
        else groups.push([entry]);
    }

    return groups;
}

function compareEvidence(
    left: TiebreakPlacementInput["entries"][number] | null | undefined,
    right: TiebreakPlacementInput["entries"][number] | null | undefined,
): number {
    const leftFailed = left?.isFailed === true ? 1 : 0;
    const rightFailed = right?.isFailed === true ? 1 : 0;
    if (leftFailed !== rightFailed) return leftFailed - rightFailed;

    return Number(right?.value ?? 0) - Number(left?.value ?? 0);
}

/**
 * Turns the groups into placements, and settles the ties nobody has to play for.
 *
 * A group whose positions would send people to different places is left tied and
 * reported: who advances is not something an average taken over other songs may
 * decide, and the match stays blocked until a tiebreak is played. Every other
 * group is separated here by the average of the match itself, which is fair
 * because the people in it ran the same songs.
 */
function materialize(groups: PlacementGroup[], rules: AdvancementRouting[], averages: Map<number, number | null>): PlacementResolution {
    const outgoing = rules.filter((rule) => rule.sourceKind === "match");
    const ruleByPlacement = new Map(outgoing.map((rule) => [rule.sourcePlacement, rule]));
    const entries: MatchResultEntryDto[] = [];
    const ambiguousTies: MatchPlacementTieDto[] = [];
    let offset = 0;

    for (const group of groups) {
        const placement = offset + 1;

        if (separatesOutcomes(group, placement, ruleByPlacement)) {
            entries.push(...byPlayerId(group).map((entry) => ({ ...entry, placement })));
            ambiguousTies.push({
                playerIds: byPlayerId(group).map((entry) => entry.playerId),
                fromPlacement: placement,
                toPlacement: placement + group.length - 1,
            });
        } else {
            let settled = placement;
            for (const separated of splitByAverage(group, averages)) {
                entries.push(...byPlayerId(separated).map((entry) => ({ ...entry, placement: settled })));
                settled += separated.length;
            }
        }

        offset += group.length;
    }

    return { entries, ambiguousTies };
}

function separatesOutcomes(group: PlacementGroup, placement: number, ruleByPlacement: Map<number, AdvancementRouting>): boolean {
    if (group.length < 2) {
        return false;
    }

    return new Set(group.map((_, index) => outcomeOf(ruleByPlacement.get(placement + index)))).size > 1;
}

/**
 * Splits a tied group by the average of the runs behind it.
 *
 * One member with nothing to average leaves the whole group tied. Ranking a set
 * where somebody has no comparable evidence would order them against nothing,
 * and a comparison that separates two people while neither can be separated from
 * a third is not an order at all.
 */
function splitByAverage(group: PlacementGroup, averages: Map<number, number | null>): PlacementGroup[] {
    if (group.length < 2 || group.some((entry) => averages.get(entry.playerId) === null || averages.get(entry.playerId) === undefined)) {
        return [group];
    }

    const average = (entry: MatchResultEntryDto) => comparableAverage(averages.get(entry.playerId) ?? 0);
    const ordered = [...group].sort((left, right) => average(right) - average(left) || left.playerId - right.playerId);
    const groups: PlacementGroup[] = [];

    for (const entry of ordered) {
        const last = groups.at(-1);
        if (last && average(last[0]) === average(entry)) {
            last.push(entry);
        } else {
            groups.push([entry]);
        }
    }

    return groups;
}

/**
 * A mean of percentages, at the precision two of them can actually differ by.
 *
 * A percentage carries two decimals — FQ-028 — so the closest two means of the
 * same count can be is a hundredth divided by that count. Four decimals is well
 * inside that and well outside the last-bit disagreement between two sums of the
 * same values added in a different order, which would otherwise separate a tie
 * that is real.
 */
function comparableAverage(value: number): number {
    return Math.round(value * 10_000);
}

function byPlayerId(group: PlacementGroup): PlacementGroup {
    return [...group].sort((left, right) => left.playerId - right.playerId);
}

function outcomeOf(rule: AdvancementRouting | undefined): string {
    return rule ? `${rule.targetKind}:${rule.targetId}:${rule.targetSlot}` : "none";
}
