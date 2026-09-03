import test from "node:test";
import assert from "node:assert/strict";
import type { MatchDto, ScheduleDto } from "@tournament-manager/contracts";

import { buildScheduleBoard, previewLineup, sourceLabel } from "../../src/features/schedule/model/scheduleBoard.ts";

const PIXELS_PER_MINUTE = 3;
const NOW = new Date("2026-08-25T10:50:00.000Z");

function match(overrides: Partial<MatchDto> = {}): MatchDto {
    return {
        id: 101,
        name: "Winners R1",
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
        phaseGroupId: 7,
        ...overrides,
    } as MatchDto;
}

function schedule(overrides: Partial<ScheduleDto> = {}): ScheduleDto {
    return {
        id: 1,
        name: "Cabinet A",
        willStartAt: "2026-08-25T10:00:00.000Z",
        status: "running",
        currentEntryId: 12,
        staleCode: null,
        staleDetails: null,
        interruptionCode: null,
        interruptionDetails: null,
        interruptedAt: null,
        archivedAt: null,
        version: 1,
        entries: [
            {
                id: 11,
                position: 0,
                expectedDurationMinutes: 30,
                startedAt: "2026-08-25T10:00:00.000Z",
                completedAt: "2026-08-25T10:25:00.000Z",
                match: match({ id: 101, matchResult: { id: 1, playerPoints: [{ playerId: 5, points: 6, placement: 1 }] } }),
            },
            {
                id: 12,
                position: 1,
                expectedDurationMinutes: 20,
                startedAt: "2026-08-25T10:25:00.000Z",
                completedAt: null,
                match: match({ id: 102, name: "Winners R2", active: true }),
            },
            { id: 13, position: 2, expectedDurationMinutes: 40, startedAt: null, completedAt: null, match: match({ id: 103, name: "Losers R2" }) },
        ],
        ...overrides,
    };
}

function board(input = schedule()) {
    return buildScheduleBoard([input], PIXELS_PER_MINUTE, NOW);
}

test("a settled entry occupies the time it actually took, not the time it was given", () => {
    const [block] = board().columns[0].blocks;

    assert.equal(block.state, "completed");
    assert.equal(block.height, 25 * PIXELS_PER_MINUTE);
});

test("the entry being played keeps growing once it passes its expected end", () => {
    const block = board().columns[0].blocks[1];

    assert.equal(block.state, "playing");
    /* It started at 10:25 and was given twenty minutes; at 10:50 it is still on,
       so the block reaches the present rather than stopping where everyone can
       see it has not. */
    assert.equal(block.endMs, NOW.getTime());
    assert.equal(block.height, 25 * PIXELS_PER_MINUTE);
});

test("a schedule waiting on somebody says so on its current entry alone", () => {
    const waiting = board(schedule({ staleCode: "UNRESOLVED_ENTRANTS" })).columns[0].blocks;

    assert.deepEqual(waiting.map((block) => block.state), ["completed", "waiting", "upcoming"]);
});

test("the axis starts on a half hour and carries the present", () => {
    const model = board();

    /* The first entry starts at 10:00, which is already a tick, so the axis
       opens there and the labels run every half hour from it. */
    assert.equal(new Date(model.ticks[0].atMs).toISOString(), "2026-08-25T10:00:00.000Z");
    assert.equal(new Date(model.ticks[1].atMs).toISOString(), "2026-08-25T10:30:00.000Z");
    assert.equal(model.nowTop, 50 * PIXELS_PER_MINUTE);
});

test("a block never shrinks below a touch target, however short the match", () => {
    const brief = schedule({
        currentEntryId: null,
        status: "inactive",
        entries: [{ id: 21, position: 0, expectedDurationMinutes: 5, startedAt: null, completedAt: null, match: match({ id: 201 }) }],
    });

    const [block] = board(brief).columns[0].blocks;
    assert.equal(block.height, 44);
    assert.equal(block.compact, true);
});

test("a finished match collapses to its winner and an open one lists who is in it", () => {
    const played = match({
        entrants: [
            { id: 1, name: "ALESSIO", type: "player", status: "active", participants: [{ id: 1, roles: [], status: "active", player: { id: 5, playerName: "ALESSIO" } }] },
            { id: 2, name: "MARTA", type: "player", status: "active", participants: [{ id: 2, roles: [], status: "active", player: { id: 6, playerName: "MARTA" } }] },
        ] as never,
        matchResult: { id: 1, playerPoints: [{ playerId: 5, points: 6, placement: 1 }] },
    });

    assert.equal(previewLineup(played).winnerName, "ALESSIO");
    assert.deepEqual(previewLineup(played).playerNames, ["ALESSIO", "MARTA"]);
});

test("the slots a match is still waiting for are named by the rule that feeds them", () => {
    const pending = match({
        id: 300,
        entrants: [
            { id: 1, name: "ALESSIO", type: "player", status: "active", participants: [{ id: 1, roles: [], status: "active", player: { id: 5, playerName: "ALESSIO" } }] },
        ] as never,
        advancementRules: [
            { id: 1, sourceKind: "match", sourceId: 101, sourceName: "Winners R1", sourcePlacement: 1, targetKind: "match", targetId: 300, targetName: "Grand final", targetSlot: 1 },
            { id: 2, sourceKind: "phase_group", sourceId: 9, sourceName: "Pool C", sourcePlacement: 2, targetKind: "match", targetId: 300, targetName: "Grand final", targetSlot: 2 },
        ],
    });

    /* One entrant is in, so the first slot is taken and the second is the one
       still open. The API remains the authority on whether the match can start. */
    assert.deepEqual(previewLineup(pending).pendingSources, ["2nd from Pool C"]);
});

test("a rule whose source no longer exists is still named, by what it points at", () => {
    const orphan = { id: 3, sourceKind: "match" as const, sourceId: 42, sourceName: null, sourcePlacement: 1, targetKind: "match" as const, targetId: 300, targetName: null, targetSlot: 1 };

    assert.equal(sourceLabel(orphan), "1st from Match 42");
});
