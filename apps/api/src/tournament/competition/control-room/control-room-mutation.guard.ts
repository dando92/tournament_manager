import { ConflictException, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

import { ControlRoomRunner } from "./control-room.runner";
import { ControlRoomStore } from "./control-room.store";

type RollbackFlow = {
    flowId: number;
    flowName: string;
    status: "running" | "paused";
    matchPosition: number;
    currentPosition: number;
};

type CompletedFlow = {
    flowId: number;
    flowName: string;
    entryId: number;
};

/**
 * The running or paused flow a rollback of this match would invalidate: one
 * whose current position has not passed the match yet, because a flow that has
 * already moved past it keeps its history.
 */
const ROLLBACK_FLOW_OF_MATCH = `
    SELECT      flow."id" AS "flowId",
                flow."name" AS "flowName",
                flow."status" AS "status",
                target."position" AS "matchPosition",
                current."position" AS "currentPosition"
    FROM        "control_room_flow_entry" target
    JOIN        "control_room_flow" flow ON flow."id" = target."flowId"
    LEFT JOIN   "control_room_flow_entry" current ON current."id" = flow."currentEntryId"
    WHERE       target."matchId" = $1
        AND     flow."status" IN ('running', 'paused')
        AND     (current."position" IS NULL OR target."position" <= current."position")
`;

/** The completed flow this match belongs to, which reopening its result reopens. */
const COMPLETED_FLOW_OF_MATCH = `
    SELECT  flow."id" AS "flowId",
            flow."name" AS "flowName",
            entry."id" AS "entryId"
    FROM    "control_room_flow_entry" entry
    JOIN    "control_room_flow" flow ON flow."id" = entry."flowId"
    WHERE   entry."matchId" = $1
        AND flow."status" = 'completed'
`;

@Injectable()
export class ControlRoomMutationGuard {
    constructor(
        private readonly dataSource: DataSource,
        private readonly store: ControlRoomStore,
        private readonly runner: ControlRoomRunner,
    ) {}

    async assertManualActivationAllowed(tournamentId: number): Promise<void> {
        const flowIds = await this.store.operationalFlowIds(tournamentId);
        if (flowIds.length > 0) {
            throw new ConflictException({
                code: "MANUAL_ACTIVATION_DISABLED_BY_CONTROL_ROOM",
                message: "Manual match activation is unavailable while a control room flow is running or paused",
                flowIds,
            });
        }
    }

    async protectRollback(matchId: number, confirmed: boolean): Promise<void> {
        const affected = await this.rollbackFlow(matchId);
        if (!affected) {
            return;
        }
        if (!confirmed) {
            throw new ConflictException({
                code: "CONTROL_ROOM_FLOW_STOP_CONFIRMATION_REQUIRED",
                message: `This change will stop control room flow "${affected.flowName}"`,
                flowId: affected.flowId,
                flowName: affected.flowName,
                matchId,
            });
        }

        await this.runner.stop(affected.flowId, "ROLLBACK_CONFIRMED", { matchId });
    }

    async prepareResultReopen(matchId: number, confirmed: boolean): Promise<void> {
        const completed = await this.completedFlow(matchId);
        if (completed) {
            if (!confirmed) {
                throw new ConflictException({
                    code: "CONTROL_ROOM_FLOW_STOP_CONFIRMATION_REQUIRED",
                    message: `Reopening this result will reopen completed control room flow "${completed.flowName}" at this match`,
                    flowId: completed.flowId,
                    flowName: completed.flowName,
                    matchId,
                });
            }
            await this.runner.interruptCompleted(completed.flowId, completed.entryId, matchId);
            return;
        }

        await this.protectRollback(matchId, confirmed);
    }

    private async rollbackFlow(matchId: number): Promise<RollbackFlow | null> {
        const rows: RollbackFlow[] = await this.dataSource.query(ROLLBACK_FLOW_OF_MATCH, [matchId]);

        return rows[0] ?? null;
    }

    private async completedFlow(matchId: number): Promise<CompletedFlow | null> {
        const rows: CompletedFlow[] = await this.dataSource.query(COMPLETED_FLOW_OF_MATCH, [matchId]);

        return rows[0] ?? null;
    }
}
