import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LIVE_EVENT_SUBSCRIBER, RedisLiveEventSubscriber } from '@tournament-manager/live-messaging';
import { HealthController } from './health.controller';
import { RealtimeGateway } from './realtime.gateway';
import { SnapshotController } from './snapshot.controller';
import { RedisHealthService } from './redis-health.service';

@Module({
  imports: [ConfigModule.forRoot({ envFilePath: ['../../.env', '.env'], isGlobal: true })],
  controllers: [HealthController, SnapshotController],
  providers: [
    RedisLiveEventSubscriber,
    { provide: LIVE_EVENT_SUBSCRIBER, useExisting: RedisLiveEventSubscriber },
    RealtimeGateway,
    RedisHealthService,
  ],
})
export class RealtimeModule {}
