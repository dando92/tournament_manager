import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import {
  LIVE_EVENT_PUBLISHER,
  RedisLiveEventPublisher,
} from "@tournament-manager/live-messaging";
import { HealthController } from "./health.controller";
import { InternalController } from "./internal.controller";
import { SyncStartEventsPublisher } from "./syncstart-events.publisher";
import { SyncStartSessionManager } from "./syncstart-session.manager";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ["../../.env", ".env"],
      isGlobal: true,
    }),
  ],
  controllers: [HealthController, InternalController],
  providers: [
    RedisLiveEventPublisher,
    { provide: LIVE_EVENT_PUBLISHER, useExisting: RedisLiveEventPublisher },
    SyncStartEventsPublisher,
    SyncStartSessionManager,
  ],
})
export class SyncStartModule {}
