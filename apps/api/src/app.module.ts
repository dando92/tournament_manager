import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from '@auth/auth.module';

import { Entities, PersistenceModule } from '@tournament-manager/persistence';
import { TournamentModule } from '@tournament/tournament.module';
import { AccountModule } from '@account/account.module';

import { AuthService } from '@auth/services';
import { AuthController } from '@auth/controllers';
import { HealthModule } from './health/health.module';
import { LocalSeedModule } from './local-seed/local-seed.module';

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
      }),
    }),
    PersistenceModule,
    AuthModule,
    AccountModule,
    TournamentModule,
    HealthModule,
    LocalSeedModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AppModule {}
