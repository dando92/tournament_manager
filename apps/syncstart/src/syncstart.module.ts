import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import {
  DURABLE_EVENT_TRANSPORT,
  LIVE_EVENT_TRANSPORT,
  RedisEventTransport,
} from "@tournament-manager/eventing";
import { HealthController } from "./health.controller";
import { SyncStartCommandConsumer } from "./syncstart-command.consumer";
import { SyncStartEventsPublisher } from "./syncstart-events.publisher";
import { SyncStartSessionManager } from "./syncstart-session.manager";
import { SyncStartStateStore } from "./syncstart-state.store";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ["../../.env", ".env"],
      isGlobal: true,
    }),
  ],
  controllers: [HealthController],
  providers: [
    RedisEventTransport,
    { provide: DURABLE_EVENT_TRANSPORT, useExisting: RedisEventTransport },
    { provide: LIVE_EVENT_TRANSPORT, useExisting: RedisEventTransport },
    SyncStartEventsPublisher,
    SyncStartStateStore,
    SyncStartSessionManager,
    SyncStartCommandConsumer,
  ],
})
export class SyncStartModule {}
