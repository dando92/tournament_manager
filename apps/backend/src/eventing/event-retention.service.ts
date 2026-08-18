import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, QueryRunner } from 'typeorm';
import {
  DURABLE_EVENT_TRANSPORT,
  DurableEventTransport,
} from './eventing.interfaces';

interface RetentionCandidate {
  id: number;
}

@Injectable()
export class EventRetentionService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(EventRetentionService.name);
  private interval?: ReturnType<typeof setInterval>;

  constructor(
    private readonly dataSource: DataSource,
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
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    let locked = false;
    try {
      const lockRows: Array<{ locked: boolean }> = await runner.query(
        `SELECT pg_try_advisory_lock(1787085405) AS locked`,
      );
      locked = lockRows[0]?.locked === true;
      if (!locked) return 0;

      const cutoff = new Date(
        Date.now() - this.retentionDays * 24 * 60 * 60 * 1000,
      );
      const candidates: RetentionCandidate[] = await runner.query(
        `SELECT id
           FROM tournament
          WHERE status = 'closed'
            AND "closedAt" <= $1
            AND "transportPurgedAt" IS NULL
          ORDER BY "closedAt"
          LIMIT 20`,
        [cutoff],
      );
      let purged = 0;
      for (const candidate of candidates) {
        await this.purgeCandidate(runner, candidate.id);
        purged += 1;
        this.logger.log(
          `Purged transport data for tournament ${candidate.id}`,
        );
      }
      return purged;
    } finally {
      if (locked) {
        await runner.query(`SELECT pg_advisory_unlock(1787085405)`);
      }
      await runner.release();
    }
  }

  private async purgeCandidate(
    runner: QueryRunner,
    tournamentId: number,
  ): Promise<void> {
    await this.deleteDatabaseTransport(runner, tournamentId);
    await this.transport.deleteAggregate(String(tournamentId));
    await runner.query(
      `UPDATE tournament SET "transportPurgedAt" = now() WHERE id = $1`,
      [tournamentId],
    );
  }

  private async deleteDatabaseTransport(
    runner: QueryRunner,
    tournamentId: number,
  ): Promise<void> {
    while (true) {
      await runner.startTransaction();
      try {
        const inbox: Array<{ count: number }> = await runner.query(
          `WITH batch AS (
             SELECT ctid FROM event_inbox WHERE aggregate_id = $1 LIMIT $2
           ), deleted AS (
             DELETE FROM event_inbox WHERE ctid IN (SELECT ctid FROM batch) RETURNING 1
           )
           SELECT count(*)::int AS count FROM deleted`,
          [String(tournamentId), this.batchSize],
        );
        const outbox: Array<{ count: number }> = await runner.query(
          `WITH batch AS (
             SELECT ctid FROM event_outbox WHERE aggregate_id = $1 LIMIT $2
           ), deleted AS (
             DELETE FROM event_outbox WHERE ctid IN (SELECT ctid FROM batch) RETURNING 1
           )
           SELECT count(*)::int AS count FROM deleted`,
          [String(tournamentId), this.batchSize],
        );
        await runner.query(
          `DELETE FROM tournament_event_projection WHERE tournament_id = $1`,
          [tournamentId],
        );
        await runner.commitTransaction();
        if (inbox[0].count < this.batchSize && outbox[0].count < this.batchSize)
          return;
      } catch (error) {
        await runner.rollbackTransaction();
        throw error;
      }
    }
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
