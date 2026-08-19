import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EventEnvelope } from '@tournament-manager/contracts';

export interface OutboxRow {
  id: string;
  event_type: string;
  aggregate_id: string;
  payload: unknown;
}

@Injectable()
export class PostgresOutboxPersistence {
  constructor(private readonly dataSource: DataSource) {}

  insert(manager: EntityManager, event: EventEnvelope): Promise<unknown> {
    return manager.query(
      `INSERT INTO event_outbox
        (id, event_type, aggregate_id, payload)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        event.id,
        event.type,
        event.aggregateId,
        JSON.stringify(event.payload),
      ],
    );
  }

  relayBatch(
    limit: number,
    publish: (event: EventEnvelope) => Promise<void>,
  ): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const rows: OutboxRow[] = await manager.query(
        `SELECT id, event_type, aggregate_id, payload
           FROM event_outbox
          WHERE published_at IS NULL
          ORDER BY created_at
          FOR UPDATE SKIP LOCKED
          LIMIT $1`,
        [limit],
      );

      for (const row of rows) {
        await publish(this.toEvent(row));
        await manager.query(
          `UPDATE event_outbox
              SET published_at = now(), publish_attempts = publish_attempts + 1, last_error = NULL
            WHERE id = $1`,
          [row.id],
        );
      }
      return rows.length;
    });
  }

  recordFailure(eventId: string, error: string): Promise<unknown> {
    return this.dataSource.query(
      `UPDATE event_outbox
          SET publish_attempts = publish_attempts + 1, last_error = $2
        WHERE id = $1`,
      [eventId, error],
    );
  }

  private toEvent(row: OutboxRow): EventEnvelope {
    return {
      id: row.id,
      type: row.event_type,
      aggregateId: row.aggregate_id,
      payload: row.payload,
    };
  }
}
