import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from '@auth/auth.module';

import { Entities, PersistenceModule } from '@tournament-manager/persistence';
import { TournamentModule } from '@tournament/tournament.module';
import { AccountModule } from '@account/account.module';

import { HealthModule } from './health/health.module';
import { ObservabilityModule } from './observability/observability.module';
import { InternalController } from './internal.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['../../.env', '.env'],
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow('DATABASE_HOST'),
        port: parseInt(config.get('DATABASE_PORT') ?? '5432'),
        username: config.getOrThrow('DATABASE_USER'),
        password: config.getOrThrow('DATABASE_PASSWORD'),
        database: config.getOrThrow('DATABASE_NAME'),
        entities: Entities,
        synchronize: false,
        ssl:
          config.get('DATABASE_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,
        // A query slower than this is logged rather than left to be inferred
        // from a slow request.
        maxQueryExecutionTime: Number(config.get('DATABASE_SLOW_QUERY_MS') ?? 500),
        extra: {
          // The pool is per process, so a replica cannot open more than this.
          max: Number(config.get('DATABASE_POOL_MAX') ?? 10),
          // Without these, one pathological query or one abandoned transaction
          // holds a connection, and its locks, for as long as the process runs.
          statement_timeout: Number(config.get('DATABASE_STATEMENT_TIMEOUT_MS') ?? 15000),
          idle_in_transaction_session_timeout: Number(config.get('DATABASE_IDLE_TRANSACTION_TIMEOUT_MS') ?? 30000),
          // What `pg_stat_activity` shows this connection as.
          application_name: config.get('DATABASE_APPLICATION_NAME') ?? 'tournament-manager-api',
        },
      }),
    }),
    PersistenceModule,
    AuthModule,
    AccountModule,
    TournamentModule,
    HealthModule,
    ObservabilityModule,
  ],
  controllers: [InternalController],
})
export class AppModule {}
