import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventEnvelope } from '../contracts/events';
import { EventConsumer } from './event-consumer.registry';

@Injectable()
export class PostgresEventTransaction {
  constructor(private readonly dataSource: DataSource) {}

  async processOnce(
    event: EventEnvelope,
    consumer: EventConsumer,
  ): Promise<boolean> {
    let result: unknown;
    const processed = await this.dataSource.transaction(async (manager) => {
      const inserted: Array<{ event_id: string }> = await manager.query(
        `INSERT INTO event_inbox (consumer, event_id, aggregate_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING
         RETURNING event_id`,
        [consumer.identity, event.id, event.aggregateId],
      );
      if (inserted.length === 0) return false;
      result = await consumer.handle(manager, event);
      return true;
    });
    if (processed && consumer.afterCommit) {
      await consumer.afterCommit(event, result);
    }
    return processed;
  }
}
