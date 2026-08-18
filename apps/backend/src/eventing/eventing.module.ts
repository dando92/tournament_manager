import { Module } from '@nestjs/common';
import {
  DURABLE_EVENT_TRANSPORT,
  LIVE_EVENT_TRANSPORT,
} from './eventing.interfaces';
import { DurableEventConsumerService } from './durable-event-consumer.service';
import { EventingRunnerService } from './eventing-runner.service';
import { OutboxRelayService } from './outbox-relay.service';
import { OutboxService } from './outbox.service';
import { RedisEventTransport } from './redis-event.transport';
import { EventRetentionService } from './event-retention.service';
import { PersistenceModule } from '../persistence/persistence.module';
import { PostgresEventConsumerPersistence } from './postgres-event-consumer.persistence';
import { PostgresEventRetentionPersistence } from './postgres-event-retention.persistence';
import { PostgresOutboxPersistence } from './postgres-outbox.persistence';
import { DurableEventHandlerRegistry } from './durable-event-handler.registry';

@Module({
  imports: [PersistenceModule],
  providers: [
    RedisEventTransport,
    { provide: DURABLE_EVENT_TRANSPORT, useExisting: RedisEventTransport },
    { provide: LIVE_EVENT_TRANSPORT, useExisting: RedisEventTransport },
    OutboxService,
    OutboxRelayService,
    DurableEventConsumerService,
    EventingRunnerService,
    EventRetentionService,
    PostgresEventConsumerPersistence,
    PostgresEventRetentionPersistence,
    PostgresOutboxPersistence,
    DurableEventHandlerRegistry,
  ],
  exports: [
    OutboxService,
    OutboxRelayService,
    DurableEventConsumerService,
    EventRetentionService,
    DURABLE_EVENT_TRANSPORT,
    LIVE_EVENT_TRANSPORT,
    DurableEventHandlerRegistry,
  ],
})
export class EventingModule {}
