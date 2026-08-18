import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

@Injectable()
export class PostgresAdvisoryLock {
  constructor(private readonly dataSource: DataSource) {}

  async runIfAcquired<T>(
    key: number,
    work: (runner: QueryRunner) => Promise<T>,
  ): Promise<T | null> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    let acquired = false;
    try {
      const rows: Array<{ locked: boolean }> = await runner.query(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [key],
      );
      acquired = rows[0]?.locked === true;
      return acquired ? await work(runner) : null;
    } finally {
      if (acquired) {
        await runner.query('SELECT pg_advisory_unlock($1)', [key]);
      }
      await runner.release();
    }
  }
}
