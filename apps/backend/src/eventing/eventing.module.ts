import { Module } from '@nestjs/common';
import {
  DURABLE_EVENT_TRANSPORT,
  LIVE_EVENT_TRANSPORT,
} from './eventing.interfaces';
import { OutboxService } from './outbox.service';
import { RedisEventTransport } from './redis-event.transport';
import { PersistenceModule } from '../persistence/persistence.module';
import { PostgresOutboxPersistence } from './postgres-outbox.persistence';

@Module({
  imports: [PersistenceModule],
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
