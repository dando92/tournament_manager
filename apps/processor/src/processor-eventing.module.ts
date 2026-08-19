import { Module } from '@nestjs/common';
import { ScoringSystemProvider } from '@tournament-manager/application';
import {
  DURABLE_EVENT_TRANSPORT,
  LIVE_EVENT_TRANSPORT,
  PostgresOutboxPersistence,
  RedisEventTransport,
} from '@tournament-manager/eventing';
import { PersistenceModule } from '@backend/persistence/persistence.module';
import { OutboxRelayService } from '@processor/eventing/outbox-relay.service';
import { DurableEventConsumerService } from '@processor/eventing/durable-event-consumer.service';
import { EventingRunnerService } from '@processor/eventing/eventing-runner.service';
import { EventRetentionService } from '@processor/eventing/event-retention.service';
import { PostgresEventTransaction } from '@processor/eventing/postgres-event-transaction';
import { PostgresEventRetentionPersistence } from '@processor/eventing/postgres-event-retention.persistence';
import { EventConsumerRegistry } from '@processor/eventing/event-consumer.registry';
import { TournamentCreatedHandler } from '@processor/tournament-created.handler';
import { LobbySongCompletedHandler } from '@processor/lobby-song-completed.handler';

@Module({
  imports: [PersistenceModule],
  providers: [
    RedisEventTransport,
    { provide: DURABLE_EVENT_TRANSPORT, useExisting: RedisEventTransport },
    { provide: LIVE_EVENT_TRANSPORT, useExisting: RedisEventTransport },
    OutboxRelayService,
    DurableEventConsumerService,
    EventingRunnerService,
    EventRetentionService,
    PostgresEventTransaction,
    PostgresEventRetentionPersistence,
    PostgresOutboxPersistence,
    EventConsumerRegistry,
    ScoringSystemProvider,
    TournamentCreatedHandler,
    LobbySongCompletedHandler,
  ],
})
export class ProcessorEventingModule {}
