import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entities, PersistenceModule } from '@tournament-manager/persistence';
import { LocalFixturesModule } from './local-fixtures.module';
import { LocalFixturesService } from './local-fixtures.service';

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: ['../../.env', '.env'], isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.getOrThrow<string>('DATABASE_HOST'),
        port: Number(config.get('DATABASE_PORT') ?? 5432),
        username: config.getOrThrow<string>('DATABASE_USER'),
        password: config.getOrThrow<string>('DATABASE_PASSWORD'),
        database: config.getOrThrow<string>('DATABASE_NAME'),
        entities: Entities,
        synchronize: false,
        ssl: config.get('DATABASE_SSL') === 'true' ? { rejectUnauthorized: false } : false,
      }),
    }),
    PersistenceModule,
    LocalFixturesModule,
  ],
})
class LocalFixturesApplicationModule {}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(LocalFixturesApplicationModule);
  try {
    await app.get(LocalFixturesService).apply();
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('Local fixture application failed.', error);
  process.exitCode = 1;
});
