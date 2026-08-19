import { Module } from '@nestjs/common';
import {
  DURABLE_EVENT_TRANSPORT,
  LIVE_EVENT_TRANSPORT,
  OutboxService,
  PostgresOutboxPersistence,
  RedisEventTransport,
} from '@tournament-manager/eventing';

@Module({
  providers: [
    RedisEventTransport,
    { provide: DURABLE_EVENT_TRANSPORT, useExisting: RedisEventTransport },
    { provide: LIVE_EVENT_TRANSPORT, useExisting: RedisEventTransport },
    OutboxService,
    PostgresOutboxPersistence,
  ],
  exports: [
    OutboxService,
    DURABLE_EVENT_TRANSPORT,
    LIVE_EVENT_TRANSPORT,
  ],
})
export class EventingModule {}
