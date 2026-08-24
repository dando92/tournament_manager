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

        await this.runner.stop(affected.flowId);
    }

    async assertResultCanReopen(matchId: number): Promise<void> {
        await this.store.assertResultCanReopen(matchId);
    }

    private async rollbackFlow(matchId: number): Promise<RollbackFlow | null> {
        const rows: RollbackFlow[] = await this.dataSource.query(
            `SELECT flow.id AS "flowId", flow.name AS "flowName", flow.status AS "status",
                    target.position AS "matchPosition", current.position AS "currentPosition"
             FROM "control_room_flow_entry" target
             JOIN "control_room_flow" flow ON flow.id = target."flowId"
             LEFT JOIN "control_room_flow_entry" current ON current.id = flow."currentEntryId"
             WHERE target."matchId" = $1 AND flow.status IN ('running', 'paused')
               AND (current.position IS NULL OR target.position <= current.position)`,
            [matchId],
        );

        return rows[0] ?? null;
    }
}
