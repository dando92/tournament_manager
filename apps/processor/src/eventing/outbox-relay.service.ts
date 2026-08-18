import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DURABLE_EVENT_TRANSPORT,
  DurableEventTransport,
} from '../../../backend/src/eventing/eventing.interfaces';
import { PostgresOutboxPersistence } from '../../../backend/src/eventing/postgres-outbox.persistence';

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);

  constructor(
    private readonly persistence: PostgresOutboxPersistence,
    private readonly config: ConfigService,
    @Inject(DURABLE_EVENT_TRANSPORT)
    private readonly transport: DurableEventTransport,
  ) {}

  async relayBatch(limit = 50): Promise<number> {
    let currentId: string | null = null;
    try {
      return await this.persistence.relayBatch(limit, async (event) => {
        currentId = event.id;
        await this.transport.publish(
          this.config.get('EVENT_STREAM') ?? 'tournament-manager.events',
          event,
        );
      });
    } catch (error) {
      if (currentId) {
        await this.persistence.recordFailure(
          currentId,
          this.errorMessage(error),
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
