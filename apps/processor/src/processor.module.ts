import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entities } from '@persistence/entities';
import { PersistenceModule } from '@backend/persistence/persistence.module';
import { HealthModule } from '@backend/health/health.module';
import { ProcessorEventingModule } from '@processor/processor-eventing.module';

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
        port: Number(config.get('DATABASE_PORT') ?? 5432),
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
    ProcessorEventingModule,
    HealthModule,
  ],
})
export class ProcessorModule {}
