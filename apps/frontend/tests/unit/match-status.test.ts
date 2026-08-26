import test from "node:test";
import assert from "node:assert/strict";

import { getMatchCommitState, getMatchProgress, getMatchProgressLabel } from "../../src/features/match/model/matchStatus.ts";
import type { Match } from "../../src/features/match/model/types.ts";

function match(status: Match["resultState"]["status"]): Match {
  return {
    id: 1,
    name: "Match",
    subtitle: "",
    notes: "",
    scoringSystem: "PlacementPointsWithFailZero",
    active: false,
    entrants: [],
    rounds: [{ id: 1, song: null, standings: [] }],
    tiebreaks: [],
    advancementRules: [],
    resultState: { status, entries: [], ambiguousTies: [] },
    matchResult: null,
    phaseGroupId: 1,
  };
}

test("shows the tiebreak action instead of commit for an ambiguous placement", () => {
  const tied = match("tiebreak_required");

  assert.equal(getMatchProgress(tied), "tiebreakRequired");
  assert.equal(getMatchProgressLabel("tiebreakRequired"), "Tiebreak required");
  assert.equal(getMatchCommitState(tied), "Tiebreak");
});

test("uses the server result state as the commit authority", () => {
  assert.equal(getMatchCommitState(match("ready")), "Pending");
  assert.equal(getMatchCommitState(match("incomplete")), "Disabled");
});
