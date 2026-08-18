import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { PostgresAdvisoryLock } from '../../../backend/src/persistence/postgres-advisory-lock';

interface RetentionCandidate {
  id: number;
}

@Injectable()
export class PostgresEventRetentionPersistence {
  private static readonly sweepLockKey = 1787085405;

  constructor(private readonly advisoryLock: PostgresAdvisoryLock) {}

  async runSweep(
    cutoff: Date,
    batchSize: number,
    purgeRedis: (tournamentId: number) => Promise<void>,
  ): Promise<number> {
    const result = await this.advisoryLock.runIfAcquired(
      PostgresEventRetentionPersistence.sweepLockKey,
      async (runner) => {
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
        for (const candidate of candidates) {
          await this.deleteDatabaseTransport(runner, candidate.id, batchSize);
          await purgeRedis(candidate.id);
          await runner.query(
            `UPDATE tournament SET "transportPurgedAt" = now() WHERE id = $1`,
            [candidate.id],
          );
        }
        return candidates.length;
      },
    );
    return result ?? 0;
  }

  private async deleteDatabaseTransport(
    runner: QueryRunner,
    tournamentId: number,
    batchSize: number,
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
          [String(tournamentId), batchSize],
        );
        const outbox: Array<{ count: number }> = await runner.query(
          `WITH batch AS (
             SELECT ctid FROM event_outbox WHERE aggregate_id = $1 LIMIT $2
           ), deleted AS (
             DELETE FROM event_outbox WHERE ctid IN (SELECT ctid FROM batch) RETURNING 1
           )
           SELECT count(*)::int AS count FROM deleted`,
          [String(tournamentId), batchSize],
        );
        await runner.query(
          'DELETE FROM tournament_event_projection WHERE tournament_id = $1',
          [tournamentId],
        );
        await runner.commitTransaction();
        if (inbox[0].count < batchSize && outbox[0].count < batchSize) return;
      } catch (error) {
        await runner.rollbackTransaction();
        throw error;
      }
    }
  }
}
