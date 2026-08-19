import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tournament } from '@tournament-manager/persistence';
import { LocalFixturesService } from './local-fixtures.service';
import {
  DURABLE_EVENT_TRANSPORT,
  RedisEventTransport,
} from '@tournament-manager/eventing';

@Module({
  imports: [TypeOrmModule.forFeature([Tournament])],
  providers: [
    RedisEventTransport,
    { provide: DURABLE_EVENT_TRANSPORT, useExisting: RedisEventTransport },
    LocalFixturesService,
  ],
  exports: [LocalFixturesService],
})
export class LocalFixturesModule {}
