import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { EventEnvelope } from '../contracts/events';
import {
  DURABLE_EVENT_TRANSPORT,
  DurableEventTransport,
} from './eventing.interfaces';

interface OutboxRow {
  id: string;
  event_type: string;
  event_version: number;
  aggregate_id: string;
  occurred_at: Date;
  correlation_id: string;
  causation_id: string | null;
  payload: unknown;
}

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    @Inject(DURABLE_EVENT_TRANSPORT)
    private readonly transport: DurableEventTransport,
  ) {}

  async relayBatch(limit = 50): Promise<number> {
    let currentId: string | null = null;
    try {
      return await this.dataSource.transaction(async (manager) => {
        const rows: OutboxRow[] = await manager.query(
          `SELECT id, event_type, event_version, aggregate_id, occurred_at,
                  correlation_id, causation_id, payload
             FROM event_outbox
            WHERE published_at IS NULL
            ORDER BY created_at
            FOR UPDATE SKIP LOCKED
            LIMIT $1`,
          [limit],
        );

        for (const row of rows) {
          currentId = row.id;
          const event: EventEnvelope = {
            id: row.id,
            type: row.event_type,
            version: row.event_version,
            aggregateId: row.aggregate_id,
            occurredAt: row.occurred_at.toISOString(),
            correlationId: row.correlation_id,
            causationId: row.causation_id,
            payload: row.payload,
          };
          await this.transport.publish(
            this.config.get('EVENT_STREAM') ?? 'tournament-manager.events',
            event,
          );
          await manager.query(
            `UPDATE event_outbox
                SET published_at = now(), publish_attempts = publish_attempts + 1, last_error = NULL
              WHERE id = $1`,
            [row.id],
          );
        }
        return rows.length;
      });
    } catch (error) {
      if (currentId) {
        await this.dataSource.query(
          `UPDATE event_outbox
              SET publish_attempts = publish_attempts + 1, last_error = $2
            WHERE id = $1`,
          [currentId, this.errorMessage(error)],
        );
      }
      this.logger.error(
        `Outbox relay failed${currentId ? ` for ${currentId}` : ''}: ${this.errorMessage(error)}`,
      );
      throw error;
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error
      ? error.message.slice(0, 2000)
      : String(error).slice(0, 2000);
  }
}
