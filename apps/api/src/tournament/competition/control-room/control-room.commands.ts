import { Injectable } from "@nestjs/common";

import { UiUpdatePublisher } from "@tournament/shared/ui-update.publisher";
import { ControlRoomRunner } from "./control-room.runner";
import { ControlRoomStore } from "./control-room.store";

@Injectable()
export class ControlRoomCommands {
    constructor(
        private readonly store: ControlRoomStore,
        private readonly runner: ControlRoomRunner,
        private readonly publisher: UiUpdatePublisher,
    ) {}

    async create(tournamentId: number, name: string, willStartAt: Date, defaultExpectedDurationMinutes: number, matchIds: number[]): Promise<number> {
        const flowId = await this.store.create(tournamentId, name, willStartAt, defaultExpectedDurationMinutes, matchIds);
        await this.publisher.emitControlRoomFlowUpdate(tournamentId, flowId);

        return flowId;
    }

    async updateDetails(flowId: number, name: string, willStartAt: Date): Promise<void> {
        const flow = await this.store.loadOrFail(flowId);
        flow.updateDetails(name, willStartAt);
        await this.store.save(flow);
        await this.publisher.emitControlRoomFlowUpdate(flow.tournamentId, flow.id);
    }

    async remove(flowId: number): Promise<void> {
        const flow = await this.store.loadOrFail(flowId);
        const tournamentId = flow.tournamentId;
        await this.store.remove(flow);
        await this.publisher.emitControlRoomFlowUpdate(tournamentId, flowId);
    }

    async replaceEntries(flowId: number, version: number, entries: Array<{ matchId: number; expectedDurationMinutes: number }>): Promise<void> {
        const flow = await this.store.loadOrFail(flowId);
        await this.store.replaceEntries(flowId, version, entries);
        await this.publisher.emitControlRoomFlowUpdate(flow.tournamentId, flowId);
    }

    async updateExpectedDuration(flowId: number, entryId: number, expectedDurationMinutes: number): Promise<void> {
        const tournamentId = await this.store.updateExpectedDuration(flowId, entryId, expectedDurationMinutes);
        await this.publisher.emitControlRoomFlowUpdate(tournamentId, flowId);
    }

    async start(flowId: number, entryId?: number): Promise<void> {
        const flow = await this.store.loadOrFail(flowId);
        flow.start(entryId);
        await this.store.save(flow);
        await this.runner.recalculate(flowId);
    }

    async pause(flowId: number): Promise<void> {
        const flow = await this.store.loadOrFail(flowId);
        flow.pause();
        await this.store.save(flow);
        await this.publisher.emitControlRoomFlowUpdate(flow.tournamentId, flowId);
    }

    async resume(flowId: number): Promise<void> {
        const flow = await this.store.loadOrFail(flowId);
        flow.resume();
        await this.store.save(flow);
        await this.runner.recalculate(flowId);
    }

    async stop(flowId: number): Promise<void> {
        await this.runner.stop(flowId);
    }

    async archive(flowId: number): Promise<void> {
        const flow = await this.store.loadOrFail(flowId);
        flow.archive();
        await this.store.save(flow);
        await this.publisher.emitControlRoomFlowUpdate(flow.tournamentId, flowId);
    }

    async unarchive(flowId: number): Promise<void> {
        const flow = await this.store.loadOrFail(flowId);
        flow.unarchive();
        await this.store.save(flow);
        await this.publisher.emitControlRoomFlowUpdate(flow.tournamentId, flowId);
    }
}
