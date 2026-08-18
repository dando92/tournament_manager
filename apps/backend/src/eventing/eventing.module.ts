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

@Module({
  providers: [
    RedisEventTransport,
    { provide: DURABLE_EVENT_TRANSPORT, useExisting: RedisEventTransport },
    { provide: LIVE_EVENT_TRANSPORT, useExisting: RedisEventTransport },
    OutboxService,
    OutboxRelayService,
    DurableEventConsumerService,
    EventingRunnerService,
  ],
  exports: [
    OutboxService,
    OutboxRelayService,
    DurableEventConsumerService,
    DURABLE_EVENT_TRANSPORT,
    LIVE_EVENT_TRANSPORT,
  ],
})
export class EventingModule {}
