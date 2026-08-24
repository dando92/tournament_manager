import { Injectable } from "@nestjs/common";

import { UiUpdatePublisher } from "@tournament/shared/ui-update.publisher";
import { ControlRoomAggregate } from "./control-room.aggregate";
import { ControlRoomRunner } from "./control-room.runner";
import { ControlRoomStore } from "./control-room.store";

@Injectable()
export class ControlRoomCommands {
    constructor(
        private readonly store: ControlRoomStore,
        private readonly runner: ControlRoomRunner,
        private readonly publisher: UiUpdatePublisher,
    ) {}

    async create(tournamentId: number, name: string): Promise<number> {
        const flow = ControlRoomAggregate.create(name, await this.store.loadTournament(tournamentId));
        await this.store.save(flow);
        await this.publisher.emitControlRoomFlowUpdate(tournamentId, flow.id);

        return flow.id;
    }

    async rename(flowId: number, name: string): Promise<void> {
        const flow = await this.store.loadOrFail(flowId);
        flow.rename(name);
        await this.store.save(flow);
        await this.publisher.emitControlRoomFlowUpdate(flow.tournamentId, flow.id);
    }

    async remove(flowId: number): Promise<void> {
        const flow = await this.store.loadOrFail(flowId);
        const tournamentId = flow.tournamentId;
        await this.store.remove(flow);
        await this.publisher.emitControlRoomFlowUpdate(tournamentId, flowId);
    }

    async replaceEntries(flowId: number, version: number, matchIds: number[]): Promise<void> {
        const flow = await this.store.loadOrFail(flowId);
        await this.store.replaceEntries(flowId, version, matchIds);
        await this.publisher.emitControlRoomFlowUpdate(flow.tournamentId, flowId);
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
