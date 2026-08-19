import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LIVE_EVENT_TRANSPORT, RedisEventTransport } from '@tournament-manager/eventing';
import { HealthController } from './health.controller';
import { RealtimeGateway } from './realtime.gateway';
import { SnapshotController } from './snapshot.controller';
import { RedisHealthService } from './redis-health.service';

@Module({
  imports: [ConfigModule.forRoot({ envFilePath: ['../../.env', '.env'], isGlobal: true })],
  controllers: [HealthController, SnapshotController],
  providers: [
    RedisEventTransport,
    { provide: LIVE_EVENT_TRANSPORT, useExisting: RedisEventTransport },
    RealtimeGateway,
    RedisHealthService,
  ],
})
export class RealtimeModule {}
