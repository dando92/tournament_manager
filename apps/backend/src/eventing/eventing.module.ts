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
import { PostgresEventTransaction } from './postgres-event-transaction';
import { PostgresEventRetentionPersistence } from './postgres-event-retention.persistence';
import { PostgresOutboxPersistence } from './postgres-outbox.persistence';
import { EventConsumerRegistry } from './event-consumer.registry';
import { TournamentCreatedHandler } from './tournament-created.handler';
import { PostgresTournamentCreatedPersistence } from './postgres-tournament-created.persistence';

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
    PostgresEventTransaction,
    PostgresEventRetentionPersistence,
    PostgresOutboxPersistence,
    EventConsumerRegistry,
    TournamentCreatedHandler,
    PostgresTournamentCreatedPersistence,
  ],
  exports: [
    OutboxService,
    OutboxRelayService,
    DurableEventConsumerService,
    EventRetentionService,
    DURABLE_EVENT_TRANSPORT,
    LIVE_EVENT_TRANSPORT,
    EventConsumerRegistry,
  ],
})
export class EventingModule {}
