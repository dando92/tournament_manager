import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DURABLE_EVENT_TRANSPORT,
  DurableEventTransport,
} from '../../../backend/src/eventing/eventing.interfaces';
import { PostgresEventRetentionPersistence } from './postgres-event-retention.persistence';

@Injectable()
export class EventRetentionService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(EventRetentionService.name);
  private interval?: ReturnType<typeof setInterval>;

  constructor(
    private readonly persistence: PostgresEventRetentionPersistence,
    private readonly config: ConfigService,
    @Inject(DURABLE_EVENT_TRANSPORT)
    private readonly transport: DurableEventTransport,
  ) {}

  onApplicationBootstrap(): void {
    void this.sweepOnce().catch((error) => this.logFailure(error));
    this.interval = setInterval(() => {
      void this.sweepOnce().catch((error) => this.logFailure(error));
    }, this.sweepIntervalMilliseconds);
  }

  onModuleDestroy(): void {
    if (this.interval) clearInterval(this.interval);
  }

  async sweepOnce(): Promise<number> {
    return this.persistence.runSweep(
      new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000),
      this.batchSize,
      async (tournamentId) => {
        await this.transport.deleteAggregate(String(tournamentId));
        this.logger.log(`Purged transport data for tournament ${tournamentId}`);
      },
    );
  }

  private get retentionDays(): number {
    return this.numberConfig('TOURNAMENT_TRANSPORT_RETENTION_DAYS', 10, 0);
  }

  private get sweepIntervalMilliseconds(): number {
    return this.numberConfig(
      'TRANSPORT_RETENTION_SWEEP_INTERVAL_MS',
      6 * 60 * 60 * 1000,
      1000,
    );
  }

  private get batchSize(): number {
    return this.numberConfig('TRANSPORT_RETENTION_BATCH_SIZE', 1000, 1);
  }

  private numberConfig(
    name: string,
    fallback: number,
    minimum: number,
  ): number {
    const value = Number(this.config.get(name) ?? fallback);
    return Number.isFinite(value) && value >= minimum ? value : fallback;
  }

  private logFailure(error: unknown): void {
    this.logger.error(
      `Transport retention sweep failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
