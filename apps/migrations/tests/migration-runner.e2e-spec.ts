import { DataSource } from 'typeorm';
import { createMigrationDataSource } from '../src/migration-data-source';
import { TournamentTimelineTiming1788300000000 } from '../src/migrations/1788300000000-TournamentTimelineTiming';

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
    expect(tables.map(({ table_name }) => table_name)).toEqual(expect.arrayContaining(['tournament', 'match', 'score', 'standing', 'control_room_flow', 'control_room_flow_entry']));
    expect(tables.map(({ table_name }) => table_name)).not.toEqual(expect.arrayContaining(['event_outbox', 'event_inbox']));
    await expect(dataSource.runMigrations({ transaction: 'all' })).resolves.toEqual([]);
  });

  it('upgrades existing control room flows without deleting them', async () => {
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    try {
      await runner.query('CREATE SCHEMA timeline_upgrade_test');
      await runner.query('SET search_path TO timeline_upgrade_test');
      await runner.query('CREATE TABLE "control_room_flow" ("id" SERIAL PRIMARY KEY, "name" varchar NOT NULL)');
      await runner.query('CREATE TABLE "control_room_flow_entry" ("id" SERIAL PRIMARY KEY, "flowId" integer, "position" integer NOT NULL)');
      await runner.query(`INSERT INTO "control_room_flow" ("name") VALUES ('Existing flow')`);
      await runner.query('INSERT INTO "control_room_flow_entry" ("flowId", "position") VALUES (1, 0)');

      const migration = new TournamentTimelineTiming1788300000000();
      await migration.up(runner);

      const [flow] = (await runner.query('SELECT "name", "willStartAt" FROM "control_room_flow"')) as unknown as Array<{
        name: string;
        willStartAt: Date;
      }>;
      const [entry] = (await runner.query(
        'SELECT "expectedDurationMinutes", "startedAt", "completedAt" FROM "control_room_flow_entry"',
      )) as unknown as Array<{ expectedDurationMinutes: number; startedAt: Date | null; completedAt: Date | null }>;
      expect(flow.name).toBe('Existing flow');
      expect(flow.willStartAt).toBeInstanceOf(Date);
      expect(entry).toEqual({ expectedDurationMinutes: 30, startedAt: null, completedAt: null });

      await migration.down(runner);
    } finally {
      await runner.query('SET search_path TO public');
      await runner.query('DROP SCHEMA IF EXISTS timeline_upgrade_test CASCADE');
      await runner.release();
    }
  });
});
