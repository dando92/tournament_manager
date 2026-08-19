import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisHealthService } from './redis-health.service';

export interface DependencyHealth {
  status: 'up' | 'down';
  detail?: string;
}

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redis: RedisHealthService,
  ) {}

  async readiness() {
    const [postgres, redis] = await Promise.all([
      this.check(() => this.dataSource.query('SELECT 1')),
      this.check(() => this.redis.ping()),
    ]);
    const migrations = postgres.status === 'up'
      ? await this.check(() => this.dataSource.query('SELECT 1 FROM migrations LIMIT 1'))
      : { status: 'down' as const, detail: 'PostgreSQL is unavailable' };
    return {
      status: postgres.status === 'up' && redis.status === 'up' && migrations.status === 'up'
        ? 'ready' as const
        : 'not_ready' as const,
      dependencies: { postgres, redis, migrations },
    };
  }

  private async check(operation: () => Promise<unknown>): Promise<DependencyHealth> {
    try {
      await operation();
      return { status: 'up' };
    } catch (error) {
      return {
        status: 'down',
        detail: error instanceof Error ? error.message : 'Unknown dependency error',
      };
    }
  }
}
