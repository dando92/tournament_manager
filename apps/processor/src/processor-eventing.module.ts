import { Module } from '@nestjs/common';
import { ScoringSystemProvider } from '@tournament-manager/application';
import { PersistenceModule } from '../../backend/src/persistence/persistence.module';
import {
  DURABLE_EVENT_TRANSPORT,
  LIVE_EVENT_TRANSPORT,
} from '../../backend/src/eventing/eventing.interfaces';
import { RedisEventTransport } from '../../backend/src/eventing/redis-event.transport';
import { OutboxRelayService } from './eventing/outbox-relay.service';
import { DurableEventConsumerService } from './eventing/durable-event-consumer.service';
import { EventingRunnerService } from './eventing/eventing-runner.service';
import { EventRetentionService } from './eventing/event-retention.service';
import { PostgresEventTransaction } from './eventing/postgres-event-transaction';
import { PostgresEventRetentionPersistence } from './eventing/postgres-event-retention.persistence';
import { PostgresOutboxPersistence } from '../../backend/src/eventing/postgres-outbox.persistence';
import { EventConsumerRegistry } from './eventing/event-consumer.registry';
import { PostgresTournamentCreatedPersistence } from './eventing/postgres-tournament-created.persistence';
import { PostgresLobbySongCompletedPersistence } from '../../backend/src/tournament/standing/postgres-lobby-song-completed.persistence';
import { TournamentCreatedHandler } from './tournament-created.handler';
import { LobbySongCompletedHandler } from './lobby-song-completed.handler';

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
    PostgresTournamentCreatedPersistence,
    PostgresLobbySongCompletedPersistence,
    ScoringSystemProvider,
    TournamentCreatedHandler,
    LobbySongCompletedHandler,
  ],
})
export class ProcessorEventingModule {}
