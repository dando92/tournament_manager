import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { EventEnvelope } from '../contracts/events';

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

    await manager.query(
      `INSERT INTO event_outbox
        (id, event_type, event_version, aggregate_id, occurred_at, correlation_id, causation_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        event.id,
        event.type,
        event.version,
        event.aggregateId,
        event.occurredAt,
        event.correlationId,
        event.causationId,
        JSON.stringify(event.payload),
      ],
    );
    return event;
  }
}
