import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { EventEnvelope } from '../contracts/events';
import { PostgresOutboxPersistence } from './postgres-outbox.persistence';

export interface NewEvent<TPayload> {
  type: string;
  version: number;
  aggregateId: string;
  payload: TPayload;
  correlationId?: string;
  causationId?: string | null;
}

@Injectable()
export class OutboxService {
  constructor(private readonly persistence: PostgresOutboxPersistence) {}

  async add<TPayload>(
    manager: EntityManager,
    input: NewEvent<TPayload>,
  ): Promise<EventEnvelope<TPayload>> {
    const id = randomUUID();
    const event: EventEnvelope<TPayload> = {
      id,
      type: input.type,
      version: input.version,
      aggregateId: input.aggregateId,
      occurredAt: new Date().toISOString(),
      correlationId: input.correlationId ?? id,
      causationId: input.causationId ?? null,
      payload: input.payload,
    };

    await this.persistence.insert(manager, event);
    return event;
  }
}
