import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  EventEnvelope,
  TournamentCreatedV1,
} from '../contracts/events';

@Injectable()
export class PostgresEventConsumerPersistence {
  constructor(private readonly dataSource: DataSource) {}

  processTournamentCreatedOnce(
    consumer: string,
    event: TournamentCreatedV1,
  ): Promise<boolean> {
    return this.processOnce(
      consumer,
      event,
      async (manager) => {
        await manager.query(
          `INSERT INTO tournament_event_projection
              (tournament_id, created_event_id, name)
             VALUES ($1, $2, $3)
             ON CONFLICT (tournament_id) DO NOTHING`,
          [event.payload.tournamentId, event.id, event.payload.name],
        );
      },
    );
  }

  private processOnce(
    consumer: string,
    event: EventEnvelope,
    effect: (manager: EntityManager) => Promise<void>,
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const inserted: Array<{ event_id: string }> = await manager.query(
        `INSERT INTO event_inbox (consumer, event_id, event_type, correlation_id, aggregate_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING event_id`,
        [consumer, event.id, event.type, event.correlationId, event.aggregateId],
      );
      if (inserted.length === 0) return false;
      await effect(manager);
      return true;
    });
  }
}
