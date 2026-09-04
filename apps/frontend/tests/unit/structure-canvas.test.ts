import test from "node:test";
import assert from "node:assert/strict";
import type { AdvancementRuleDto, MatchDto, PhaseGroupDto } from "@tournament-manager/contracts";

import {
    buildStructureCanvas,
    CARD_GAP,
    COLUMN_GAP,
    COLUMN_WIDTH,
    HEADER_HEIGHT,
    cardHeight,
    ordinal,
} from "../../src/features/structure/model/structureCanvas.ts";
import type { TournamentDivisionOption } from "../../src/features/tournament/model/types.ts";

function rule(overrides: Partial<AdvancementRuleDto> = {}): AdvancementRuleDto {
    return {
        id: 1,
        sourceKind: "phase_group",
        sourceId: 1,
        sourceName: "Pool A",
        sourcePlacement: 1,
        targetKind: "phase_group",
        targetId: 2,
        targetName: "Bracket",
        targetSlot: 1,
        ...overrides,
    };
}

function pool(overrides: Partial<PhaseGroupDto> = {}): PhaseGroupDto {
    return {
        id: 1,
        name: "Pool A",
        displayIdentifier: null,
        bracketType: null,
        state: "pending",
        matchCount: 6,
        progressedMatchCount: 0,
        pendingMatchCount: 0,
        advancementRules: [],
        ...overrides,
    } as PhaseGroupDto;
}

function division(phases: TournamentDivisionOption["phases"]): TournamentDivisionOption {
    return { id: 1, name: "Open", phases };
}

function match(overrides: Partial<MatchDto> = {}): MatchDto {
    return {
        id: 1,
        name: "Quarter 1",
        subtitle: "",
        notes: "",
        scoringSystem: "PlacementPointsWithFailZero",
        active: false,
        entrants: [],
        rounds: [],
        tiebreaks: [],
        advancementRules: [],
        resultState: { status: "incomplete", entries: [], ambiguousTies: [] },
        matchResult: null,
        phaseGroupId: 2,
        ...overrides,
    } as MatchDto;
}

const QUALIFIERS = {
    id: 10,
    name: "Qualifiers",
    matchCount: 12,
    phaseGroups: [pool({ id: 1, name: "Pool A" }), pool({ id: 2, name: "Pool B" })],
};

test("a phase is a column and a pool is a card stacked under its header", () => {
    const canvas = buildStructureCanvas({ division: division([QUALIFIERS]), matches: [], density: "pools", selection: null });

    const [first, second] = canvas.columns[0].cards;

    assert.equal(canvas.columns.length, 1);
    assert.equal(canvas.columns[0].left, 0);
    assert.deepEqual([first.top, second.top], [HEADER_HEIGHT + CARD_GAP, HEADER_HEIGHT + CARD_GAP + first.height + CARD_GAP]);
    assert.equal(canvas.columns[0].slotLabel, "Pool");
});

/* Two constants used to stand in for every card, and both were shorter than
   what a card draws, so a column overlapped itself from the second card down. */
test("a card is as tall as what it holds, and the next one starts below it", () => {
    const canvas = buildStructureCanvas({
        division: division([
            {
                id: 10,
                name: "Qualifiers",
                matchCount: 2,
                phaseGroups: [pool({ id: 1, name: "Pool A" }), pool({ id: 2, name: "Pool B" })],
            },
        ]),
        matches: [],
        density: "pools",
        selection: null,
    });

    for (const card of canvas.columns[0].cards) {
        assert.equal(card.height, cardHeight(card));
    }

    const stacked = canvas.columns[0].cards;
    assert.ok(stacked[1].top >= stacked[0].top + stacked[0].height + CARD_GAP);
});

test("a match is tall enough for the slots it is waiting on", () => {
    const canvas = buildStructureCanvas({
        division: division([{ id: 10, name: "Top 8", matchCount: 1, phaseGroups: [pool({ id: 2, name: "Bracket" })] }]),
        matches: [match({ id: 1, phaseGroupId: 2 })],
        density: "matches",
        selection: null,
    });
    const [card] = canvas.columns[0].cards;

    assert.equal(card.slots.length, 2);
    assert.equal(card.height, cardHeight(card));
});

test("columns run left to right in the order the phases run", () => {
    const canvas = buildStructureCanvas({
        division: division([QUALIFIERS, { id: 11, name: "Top 8", matchCount: 4, phaseGroups: [pool({ id: 3, name: "Bracket" })] }]),
        matches: [],
        density: "pools",
        selection: null,
    });

    assert.deepEqual(
        canvas.columns.map((column) => column.left),
        [0, COLUMN_WIDTH + COLUMN_GAP],
    );
    assert.equal(canvas.addColumnLeft, 2 * (COLUMN_WIDTH + COLUMN_GAP));
});

test("a route leaves the right edge of its source and arrives at the left edge of its target", () => {
    const canvas = buildStructureCanvas({
        division: division([
            { ...QUALIFIERS, phaseGroups: [pool({ id: 1, advancementRules: [rule({ sourceId: 1, targetId: 3 })] })] },
            { id: 11, name: "Top 8", matchCount: 4, phaseGroups: [pool({ id: 3, name: "Bracket" })] },
        ]),
        matches: [],
        density: "pools",
        selection: null,
    });

    assert.equal(canvas.edges.length, 1);
    assert.match(canvas.edges[0].path, new RegExp(`^M ${COLUMN_WIDTH} `));
    assert.ok(canvas.edges[0].path.includes(`${COLUMN_WIDTH + COLUMN_GAP} `));
    assert.equal(canvas.edges[0].highlighted, false);
});

test("selecting a pool highlights the routes that touch it", () => {
    const canvas = buildStructureCanvas({
        division: division([
            { ...QUALIFIERS, phaseGroups: [pool({ id: 1, advancementRules: [rule({ sourceId: 1, targetId: 3 })] })] },
            { id: 11, name: "Top 8", matchCount: 4, phaseGroups: [pool({ id: 3, name: "Bracket" })] },
        ]),
        matches: [],
        density: "pools",
        selection: { kind: "pool", id: 3 },
    });

    assert.equal(canvas.edges[0].highlighted, true);
});

test("a place with no route keeps its chip and is counted as going nowhere", () => {
    const canvas = buildStructureCanvas({
        division: division([
            { ...QUALIFIERS, phaseGroups: [pool({ id: 1, advancementRules: [rule({ sourceId: 1, sourcePlacement: 1, targetId: 3 })] })] },
            { id: 11, name: "Top 8", matchCount: 4, phaseGroups: [pool({ id: 3, name: "Bracket" })] },
        ]),
        matches: [],
        density: "pools",
        selection: null,
    });

    assert.deepEqual(
        canvas.columns[0].cards[0].chips.map((chip) => [chip.label, chip.routed]),
        [
            ["1st", true],
            ["2nd", false],
        ],
    );
    assert.equal(canvas.danglingPlacements, 1);
});

/* The last phase is where a tournament ends, so nobody is missing a route out of it. */
test("the last phase is not counted as going nowhere", () => {
    const canvas = buildStructureCanvas({
        division: division([{ id: 11, name: "Finals", matchCount: 1, phaseGroups: [pool({ id: 3, name: "Bracket" })] }]),
        matches: [],
        density: "pools",
        selection: null,
    });

    assert.equal(canvas.danglingPlacements, 0);
});

test("the match density draws the matches of every pool in the column", () => {
    const canvas = buildStructureCanvas({
        division: division([{ id: 11, name: "Top 8", matchCount: 2, phaseGroups: [pool({ id: 2, name: "Bracket" })] }]),
        matches: [match({ id: 1, name: "Quarter 1" }), match({ id: 2, name: "Quarter 2" })],
        density: "matches",
        selection: null,
    });

    assert.deepEqual(
        canvas.columns[0].cards.map((card) => card.name),
        ["Quarter 1", "Quarter 2"],
    );
    assert.equal(canvas.columns[0].slotLabel, "Match");
});

test("a slot filled by a route reads as where it comes from", () => {
    const canvas = buildStructureCanvas({
        division: division([{ id: 11, name: "Top 8", matchCount: 1, phaseGroups: [pool({ id: 2, name: "Bracket" })] }]),
        matches: [
            match({
                id: 5,
                advancementRules: [rule({ sourceKind: "match", sourceId: 4, sourceName: "Quarter 1", targetKind: "match", targetId: 5, targetSlot: 1 })],
            }),
        ],
        density: "matches",
        selection: null,
    });

    assert.deepEqual(canvas.columns[0].cards[0].slots, [
        { slot: 1, from: "1st of Quarter 1" },
        { slot: 2, from: null },
    ]);
});

test("ordinals read the way people say them", () => {
    assert.deepEqual([1, 2, 3, 4, 9].map(ordinal), ["1st", "2nd", "3rd", "4th", "9th"]);
});
