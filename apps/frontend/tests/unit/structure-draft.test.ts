import test from "node:test";
import assert from "node:assert/strict";
import type { AdvancementRuleDto, MatchDto, PhaseGroupDto } from "@tournament-manager/contracts";

import {
    addNode,
    changeCount,
    clearSlot,
    drawRoute,
    emptyDraft,
    indexStructure,
    projectStructure,
    removeNode,
    renameNode,
    toStructurePlan,
    type StructureDraft,
} from "../../src/features/structure/model/structureDraft.ts";
import { collectRoutes, routesOf } from "../../src/features/structure/model/structureRoutes.ts";
import type { TournamentDivisionOption } from "../../src/features/tournament/model/types.ts";

function pool(overrides: Partial<PhaseGroupDto> = {}): PhaseGroupDto {
    return {
        id: 1,
        name: "Pool A",
        displayIdentifier: null,
        bracketType: null,
        state: "pending",
        matchCount: 2,
        progressedMatchCount: 0,
        pendingMatchCount: 0,
        advancementRules: [],
        ...overrides,
    } as PhaseGroupDto;
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
        phaseGroupId: 1,
        ...overrides,
    } as MatchDto;
}

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

function division(): TournamentDivisionOption {
    return {
        id: 7,
        name: "Open",
        structureVersion: 3,
        entrantCount: 8,
        phases: [
            { id: 10, name: "Qualifiers", matchCount: 2, phaseGroups: [pool({ id: 1, name: "Pool A" })] },
            { id: 11, name: "Top 8", matchCount: 0, phaseGroups: [pool({ id: 2, name: "Bracket", matchCount: 0 })] },
        ],
    };
}

function draftOf(): StructureDraft {
    return emptyDraft(1, 7);
}

function indexOf(draft: StructureDraft, matches: MatchDto[] = []) {
    return indexStructure(division(), matches as never, draft);
}

test("a phase, a pool and a match added together come back nested, and unwritten", () => {
    let draft = addNode(draftOf(), "phase", 7, "Finals");
    const phaseId = draft.added[0].id;
    draft = addNode(draft, "pool", phaseId, "Grand Final");
    const poolId = draft.added[1].id;
    draft = addNode(draft, "match", poolId, "Match 1");

    const projected = projectStructure(division(), [], draft);
    const finals = projected.division!.phases[2];

    assert.equal(finals.name, "Finals");
    assert.equal(finals.phaseGroups![0].name, "Grand Final");
    assert.equal(finals.matchCount, 1);
    assert.ok(projected.pending.has(`pool:${poolId}`));
    assert.equal(changeCount(draft), 3);
});

test("renaming a row records the name, renaming something unwritten edits it in place", () => {
    let draft = addNode(draftOf(), "pool", 10, "Pool B");
    const added = draft.added[0].id;
    draft = renameNode(draft, { kind: "pool", id: added }, "Pool C");
    draft = renameNode(draft, { kind: "pool", id: 1 }, "Pool One");

    assert.equal(draft.added[0].name, "Pool C");
    assert.deepEqual(draft.renamed, [{ kind: "pool", id: 1, name: "Pool One" }]);

    const projected = projectStructure(division(), [], draft);
    assert.deepEqual(
        projected.division!.phases[0].phaseGroups!.map((candidate) => candidate.name),
        ["Pool One", "Pool C"],
    );
});

/* Removing a pool takes its matches with it the way the foreign keys will, and
   everything the draft said about any of them goes rather than reaching a plan
   that would name rows nobody can reach. */
test("removing a pool takes its matches and the routes that touched them", () => {
    const matches = [match({ id: 5, phaseGroupId: 1 })];
    let draft = drawRoute(draftOf(), { sourceKind: "match", sourceId: 5, placement: 1, targetKind: "pool", targetId: 2, slot: 1 });
    draft = removeNode(draft, { kind: "pool", id: 1 }, indexOf(draft, matches));

    assert.deepEqual(draft.removed, [
        { kind: "pool", id: 1 },
        { kind: "match", id: 5 },
    ]);
    assert.deepEqual(draft.routes, []);

    const projected = projectStructure(division(), matches as never, draft);
    assert.deepEqual(projected.division!.phases[0].phaseGroups, []);
    assert.deepEqual(projected.matches, []);
});

test("a drawn route replaces whatever claimed the slot, and reads on both of its ends", () => {
    const existing = rule({ sourceId: 1, targetKind: "match", targetId: 5, targetSlot: 1 });
    const withRule = division();
    withRule.phases[0].phaseGroups = [pool({ id: 1, advancementRules: [existing] })];
    const matches = [match({ id: 5, phaseGroupId: 2, advancementRules: [existing] })];

    const draft = drawRoute(draftOf(), { sourceKind: "pool", sourceId: 2, placement: 2, targetKind: "match", targetId: 5, slot: 1 });
    const projected = projectStructure(withRule, matches as never, draft);

    assert.deepEqual(projected.division!.phases[0].phaseGroups![0].advancementRules, []);
    assert.deepEqual(
        projected.matches[0].advancementRules!.map((candidate) => [candidate.sourceId, candidate.sourcePlacement]),
        [[2, 2]],
    );
});

/* A route the draft drew is taken back rather than written and then deleted, so
   undoing a mistake leaves nothing behind to apply. */
test("clearing a slot the draft filled takes the route back instead of recording a removal", () => {
    let draft = drawRoute(draftOf(), { sourceKind: "pool", sourceId: 1, placement: 1, targetKind: "pool", targetId: 2, slot: 1 });
    draft = clearSlot(draft, { targetKind: "pool", targetId: 2, slot: 1 });

    assert.deepEqual(draft.routes, []);
    assert.deepEqual(draft.cleared, []);
    assert.equal(changeCount(draft), 0);
});

test("clearing a slot a rule already filled records it as emptied", () => {
    const draft = clearSlot(draftOf(), { targetKind: "pool", targetId: 2, slot: 1 });

    assert.deepEqual(draft.cleared, [{ targetKind: "pool", targetId: 2, slot: 1 }]);
});

test("the plan carries every parent of what it changes, as links, and the version it saw", () => {
    let draft = addNode(draftOf(), "pool", 10, "Pool B");
    const poolId = draft.added[0].id;
    draft = addNode(draft, "match", poolId, "Match 1");
    draft = renameNode(draft, { kind: "pool", id: 2 }, "Bracket A");

    const plan = toStructurePlan(draft, "Open", indexOf(draft), 3);
    const byId = new Map(plan.nodes.map((node) => [node.localId, node]));

    assert.deepEqual(plan.basedOn, [{ divisionId: 7, structureVersion: 3 }]);
    assert.equal(byId.get("division:7")!.action, "link");
    assert.equal(byId.get("phase:10")!.action, "link");
    assert.equal(byId.get(`pool:${poolId}`)!.action, "create");
    assert.equal(byId.get(`pool:${poolId}`)!.parentLocalId, "phase:10");
    assert.equal(byId.get(`match:${draft.added[1].id}`)!.parentLocalId, `pool:${poolId}`);
    assert.equal(byId.get("pool:2")!.name, "Bracket A");
    assert.equal(byId.get("pool:2")!.action, "link");
});

test("a removed row reaches the plan as a removal, not as the link something else asked for", () => {
    let draft = drawRoute(draftOf(), { sourceKind: "pool", sourceId: 1, placement: 1, targetKind: "pool", targetId: 2, slot: 1 });
    draft = removeNode(draft, { kind: "pool", id: 1 }, indexOf(draft));

    const plan = toStructurePlan(draft, "Open", indexOf(draft), 3);
    const byId = new Map(plan.nodes.map((node) => [node.localId, node]));

    assert.equal(byId.get("pool:1")!.action, "remove");
    assert.deepEqual(plan.routes, []);
});

test("a route between two things that do not exist yet is expressed in local ids", () => {
    let draft = addNode(draftOf(), "pool", 10, "Pool B");
    const source = draft.added[0].id;
    draft = addNode(draft, "match", source, "Match 1");
    const target = draft.added[1].id;
    draft = drawRoute(draft, { sourceKind: "pool", sourceId: source, placement: 1, targetKind: "match", targetId: target, slot: 1 });

    const plan = toStructurePlan(draft, "Open", indexOf(draft), 3);

    assert.deepEqual(plan.routes, [
        { sourceLocalId: `pool:${source}`, sourcePlacement: 1, targetLocalId: `match:${target}`, targetSlot: 1 },
    ]);
    assert.deepEqual(plan.clearedSlots, []);
});

/* A rule is written once and read from both of its ends, so the panel asks for
   a node's routes rather than flattening the tree again on every surface. */
test("a node's routes are gathered from both of the ends they are carried on", () => {
    const out = rule({ sourceId: 1, sourceName: "Pool A", targetKind: "match", targetId: 5, targetSlot: 2 });
    const withRule = division();
    withRule.phases[0].phaseGroups = [pool({ id: 1, advancementRules: [out] })];
    const matches = [match({ id: 5, phaseGroupId: 2, advancementRules: [out] })];

    const routes = collectRoutes(withRule, matches as never);

    assert.equal(routes.length, 1);
    assert.deepEqual(routesOf(routes, "match", 5).incoming.map((entry) => entry.sourceName), ["Pool A"]);
    assert.deepEqual(routesOf(routes, "pool", 1).outgoing.map((entry) => entry.targetSlot), [2]);
    assert.deepEqual(routesOf(routes, "pool", 1).incoming, []);
});
