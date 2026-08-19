import { DataSource } from 'typeorm';
import { createMigrationDataSource } from '../src/migration-data-source';

const host = process.env.DATABASE_HOST ?? '127.0.0.1';
const port = Number(process.env.DATABASE_PORT ?? 5432);
const username = process.env.DATABASE_USER ?? 'tournament_manager';
const password = process.env.DATABASE_PASSWORD ?? 'tournament_manager';
const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false;
const database = 'tournament_manager_migration_runner_test';

describe('migration runner', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    const admin = new DataSource({ type: 'postgres', host, port, username, password, database: 'postgres', ssl });
    await admin.initialize();
    try {
      await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [database]);
      await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
      await admin.query(`CREATE DATABASE "${database}"`);
    } finally {
      await admin.destroy();
    }

    dataSource = createMigrationDataSource(database);
    await dataSource.initialize();
    await dataSource.runMigrations({ transaction: 'all' });
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    const admin = new DataSource({ type: 'postgres', host, port, username, password, database: 'postgres', ssl });
    await admin.initialize();
    try {
      await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [database]);
      await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    } finally {
      await admin.destroy();
    }
  });

  it('creates the application schema and is repeatable', async () => {
    const tables = await dataSource.query<{ table_name: string }[]>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    expect(tables.map(({ table_name }) => table_name)).toEqual(expect.arrayContaining(['tournament', 'match', 'score', 'standing']));
    await expect(dataSource.runMigrations({ transaction: 'all' })).resolves.toEqual([]);
  });
});
