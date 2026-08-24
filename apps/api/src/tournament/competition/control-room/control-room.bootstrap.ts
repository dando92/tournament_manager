import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";

import { ControlRoomRunner } from "./control-room.runner";

@Injectable()
export class ControlRoomBootstrap implements OnApplicationBootstrap {
    private readonly logger = new Logger(ControlRoomBootstrap.name);

    constructor(private readonly runner: ControlRoomRunner) {}

    async onApplicationBootstrap(): Promise<void> {
        try {
            await this.runner.reconcileRunning();
        } catch (error) {
            this.logger.error(`Control room reconciliation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
