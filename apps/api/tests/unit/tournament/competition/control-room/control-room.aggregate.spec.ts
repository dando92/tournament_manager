import { ControlRoomFlowEntry, Tournament } from "@tournament-manager/persistence";

import { ControlRoomAggregate } from "@tournament/competition/control-room/control-room.aggregate";
import { evaluateControlRoomMatch } from "@tournament/competition/control-room/control-room.eligibility";

describe("ControlRoomAggregate", () => {
    function flow() {
        const tournament = new Tournament();
        tournament.id = 3;
        const aggregate = ControlRoomAggregate.create("Cabinet 1", tournament);
        aggregate.entity.id = 7;
        aggregate.entity.version = 1;

        const first = new ControlRoomFlowEntry();
        first.id = 11;
        first.position = 0;
        aggregate.entity.entries = [first];

        return aggregate;
    }

    it("distinguishes running stale from paused", () => {
        const aggregate = flow();
        aggregate.start();
        aggregate.waitAt(11, "NOT_ENOUGH_ENTRANTS", { matchId: 20, entrantCount: 1 });

        expect(aggregate.status).toBe("running");
        expect(aggregate.entity.staleCode).toBe("NOT_ENOUGH_ENTRANTS");

        aggregate.pause();
        expect(aggregate.status).toBe("paused");
        aggregate.resume();
        expect(aggregate.status).toBe("running");
        expect(aggregate.entity.staleCode).toBeNull();
    });

    it("restarts an ordinary run from the beginning while preserving an explicit start entry", () => {
        const aggregate = flow();
        const second = new ControlRoomFlowEntry();
        second.id = 12;
        second.position = 1;
        aggregate.entity.entries.push(second);

        aggregate.start(12);
        aggregate.stop();
        aggregate.start();
        expect(aggregate.currentEntryId).toBeNull();

        aggregate.stop();
        aggregate.start(12);
        expect(aggregate.currentEntryId).toBe(12);
    });

    it("makes completed flows terminal and archivable", () => {
        const aggregate = flow();
        aggregate.start();
        aggregate.complete();
        aggregate.archive();

        expect(aggregate.status).toBe("completed");
        expect(aggregate.entity.archivedAt).toBeInstanceOf(Date);
        expect(() => aggregate.start()).toThrow("not editable");
        expect(() => aggregate.rename("Changed")).toThrow("not editable");
    });

    it("reopens a completed run at the interrupted match", () => {
        const aggregate = flow();
        aggregate.start();
        aggregate.complete();
        aggregate.archive();

        aggregate.interruptCompletedRun(11, "MATCH_RESULT_REOPENED", { matchId: 20 });

        expect(aggregate.entity).toMatchObject({
            status: "inactive",
            currentEntryId: 11,
            archivedAt: null,
            interruptionCode: "MATCH_RESULT_REOPENED",
            interruptionDetails: { matchId: 20 },
        });
        expect(aggregate.entity.interruptedAt).toBeInstanceOf(Date);
    });
});

describe("evaluateControlRoomMatch", () => {
    const playable = {
        matchId: 1,
        matchName: "Match 1",
        active: false,
        completed: false,
        readyToCommit: false,
        playerIds: [1, 2],
        roundCount: 1,
        requiredEntrantCount: 2,
        blockingMatchIds: [],
        blockingPlayerIds: [],
        isCurrentEntry: false,
    };

    it("passes settled matches and accepts a playable match", () => {
        expect(evaluateControlRoomMatch(playable)).toEqual({ kind: "eligible" });
        expect(evaluateControlRoomMatch({ ...playable, readyToCommit: true })).toEqual({ kind: "passed" });
        expect(evaluateControlRoomMatch({ ...playable, completed: true })).toEqual({ kind: "passed" });
    });

    it("reports stable entrant and overlap reasons", () => {
        expect(evaluateControlRoomMatch({ ...playable, playerIds: [] })).toMatchObject({ kind: "stale", code: "NO_ENTRANTS" });
        expect(evaluateControlRoomMatch({ ...playable, playerIds: [1] })).toMatchObject({ kind: "stale", code: "NOT_ENOUGH_ENTRANTS" });
        expect(evaluateControlRoomMatch({ ...playable, requiredEntrantCount: 3 })).toMatchObject({ kind: "stale", code: "UNRESOLVED_ENTRANTS" });
        expect(evaluateControlRoomMatch({ ...playable, blockingMatchIds: [9], blockingPlayerIds: [2] })).toMatchObject({
            kind: "stale",
            code: "ENTRANTS_ALREADY_ACTIVE",
        });
    });
});
