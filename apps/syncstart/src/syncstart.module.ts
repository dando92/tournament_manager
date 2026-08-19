import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import {
  LIVE_EVENT_PUBLISHER,
  RedisLiveEventPublisher,
} from "@tournament-manager/live-messaging";
import { HealthController } from "./health.controller";
import { InternalController } from "./internal.controller";
import { SyncStartEventsPublisher } from "./syncstart-events.publisher";
import { LobbyCatalog } from "./lobby-catalog";
import { CompletedSongSubmitter } from "./completed-song-submitter";
import { TournamentSyncStartRegistry } from "./tournament-syncstart-registry";

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({
      envFilePath: ["../../.env", ".env"],
      isGlobal: true,
    }),
  ],
  controllers: [HealthController, InternalController],
  providers: [
    RedisLiveEventPublisher,
    { provide: LIVE_EVENT_PUBLISHER, useExisting: RedisLiveEventPublisher },
    LobbyCatalog,
    CompletedSongSubmitter,
    SyncStartEventsPublisher,
    TournamentSyncStartRegistry,
  ],
})
export class SyncStartModule {}
