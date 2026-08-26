import { AdvancementRuleDto } from "@tournament-manager/contracts";

import { resolvePlacements, TiebreakPlacementInput } from "@match/placement.resolver";

function rule(sourcePlacement: number, targetId: number, targetSlot = sourcePlacement): AdvancementRuleDto {
    return {
        id: sourcePlacement,
        sourceKind: "match",
        sourceId: 10,
        sourcePlacement,
        targetKind: "match",
        targetId,
        targetSlot,
    };
}

function attempt(
    sequence: number,
    entries: Array<{ playerId: number; value: number; isFailed?: boolean }>,
): TiebreakPlacementInput {
    return {
        id: sequence,
        sequence,
        invalidated: false,
        complete: true,
        entries: entries.map((entry) => ({ ...entry, isFailed: entry.isFailed ?? null })),
    };
}

describe("resolvePlacements", () => {
    const tied = [
        { playerId: 1, points: 6 },
        { playerId: 2, points: 6 },
        { playerId: 3, points: 4 },
    ];

    it("keeps shared placement when the tie has no different advancement outcome", () => {
        const result = resolvePlacements(tied, [], []);

        expect(result.ambiguousTies).toEqual([]);
        expect(result.entries).toEqual([
            { playerId: 1, points: 6, placement: 1 },
            { playerId: 2, points: 6, placement: 1 },
            { playerId: 3, points: 4, placement: 3 },
        ]);
    });

    it("requires a tiebreak across different advancement destinations", () => {
        const result = resolvePlacements(tied, [], [rule(1, 20), rule(2, 30)]);

        expect(result.ambiguousTies).toEqual([{ playerIds: [1, 2], fromPlacement: 1, toPlacement: 2 }]);
    });

    it("uses a completed attempt only to split its tied group", () => {
        const result = resolvePlacements(tied, [attempt(1, [
            { playerId: 1, value: 96.4 },
            { playerId: 2, value: 97.2 },
        ])], [rule(1, 20), rule(2, 30)]);

        expect(result.ambiguousTies).toEqual([]);
        expect(result.entries.map(({ playerId, points, placement }) => ({ playerId, points, placement }))).toEqual([
            { playerId: 2, points: 6, placement: 1 },
            { playerId: 1, points: 6, placement: 2 },
            { playerId: 3, points: 4, placement: 3 },
        ]);
    });

    it("allows a later attempt to split the subgroup an earlier attempt left tied", () => {
        const points = [
            { playerId: 1, points: 6 },
            { playerId: 2, points: 6 },
            { playerId: 3, points: 6 },
        ];
        const result = resolvePlacements(points, [
            attempt(1, [
                { playerId: 1, value: 99 },
                { playerId: 2, value: 98 },
                { playerId: 3, value: 98 },
            ]),
            attempt(2, [
                { playerId: 2, value: 97 },
                { playerId: 3, value: 98 },
            ]),
        ], [rule(1, 20), rule(2, 30), rule(3, 40)]);

        expect(result.ambiguousTies).toEqual([]);
        expect(result.entries.map((entry) => entry.playerId)).toEqual([1, 3, 2]);
    });

    it("ranks a non-failed played result before a failed one", () => {
        const result = resolvePlacements(tied, [attempt(1, [
            { playerId: 1, value: 99, isFailed: true },
            { playerId: 2, value: 90, isFailed: false },
        ])], [rule(1, 20), rule(2, 30)]);

        expect(result.entries.map((entry) => entry.playerId)).toEqual([2, 1, 3]);
    });
});
