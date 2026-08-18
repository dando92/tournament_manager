import { DataSource } from 'typeorm';

export function createMigrationDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 5432),
    username: process.env.DATABASE_USER ?? 'tournament_manager',
    password: process.env.DATABASE_PASSWORD ?? 'tournament_manager',
    database: process.env.DATABASE_NAME ?? 'tournament_manager',
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    synchronize: false,
    migrations: [],
    migrationsTableName: 'migrations',
  });
}
