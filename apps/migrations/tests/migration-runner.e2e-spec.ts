import { DataSource } from 'typeorm';
import { createMigrationDataSource } from '../src/migration-data-source';
import { seedLocalFixture } from '../src/seed-local-fixture';
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
    expect(tables.map(({ table_name }) => table_name)).toEqual(expect.arrayContaining(['tournament', 'match', 'score', 'standing', 'schedule', 'schedule_entry']));
    expect(tables.map(({ table_name }) => table_name)).not.toEqual(expect.arrayContaining(['event_outbox', 'event_inbox']));
    await expect(dataSource.runMigrations({ transaction: 'all' })).resolves.toEqual([]);
  });

  it('creates every index the entities declare, under the declared name and columns', async () => {
    const rows = await dataSource.query<{ indexName: string; tableName: string; columns: string[] }[]>(
      `SELECT i.relname AS "indexName", t.relname AS "tableName", array_agg(a.attname::text ORDER BY k.ord) AS "columns"
       FROM pg_class t
       JOIN pg_namespace n ON n.oid = t.relnamespace
       JOIN pg_index ix ON ix.indrelid = t.oid
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
       WHERE n.nspname = 'public'
       GROUP BY i.relname, t.relname`,
    );
    const schema = new Map(rows.map((row) => [row.indexName, row]));

    const declared = dataSource.entityMetadatas.flatMap((entity) =>
      entity.indices.map((index) => ({
        name: index.name,
        tableName: entity.tableName,
        columns: index.columns.map((column) => column.databaseName),
      })),
    );
    expect(declared.length).toBeGreaterThan(0);

    for (const index of declared) {
      expect(schema.get(index.name)).toEqual({ indexName: index.name, tableName: index.tableName, columns: index.columns });
    }
  });

  it('addresses every pool and every match through one view, and a pool without matches too', async () => {
    await dataSource.query(`INSERT INTO "tournament" ("name") VALUES ('View tournament')`);
    await dataSource.query(`INSERT INTO "division" ("name", "tournamentId") SELECT 'View division', id FROM "tournament" WHERE name = 'View tournament'`);
    await dataSource.query(`INSERT INTO "phase" ("name", "divisionId") SELECT 'View phase', id FROM "division" WHERE name = 'View division'`);
    await dataSource.query(`INSERT INTO "phase_group" ("name", "phaseId") SELECT 'Empty pool', id FROM "phase" WHERE name = 'View phase'`);
    await dataSource.query(
      `INSERT INTO "match" ("name", "scoringSystem", "phaseGroupId") SELECT 'View match', 'PlacementPointsWithFailZero', id FROM "phase_group" WHERE name = 'Empty pool'`,
    );

    const rows = await dataSource.query<Array<{ tournamentId: number; divisionId: number; phaseId: number; phaseGroupId: number; matchId: number | null }>>(
      `SELECT ca.* FROM "competition_address" ca JOIN "phase_group" pg ON pg."id" = ca."phaseGroupId" WHERE pg."name" = 'Empty pool'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].matchId).not.toBeNull();

    await dataSource.query(`DELETE FROM "match" WHERE name = 'View match'`);
    const withoutMatches = await dataSource.query<Array<{ matchId: number | null }>>(
      `SELECT ca."matchId" FROM "competition_address" ca JOIN "phase_group" pg ON pg."id" = ca."phaseGroupId" WHERE pg."name" = 'Empty pool'`,
    );
    expect(withoutMatches).toEqual([{ matchId: null }]);

    await dataSource.query(`DELETE FROM "tournament" WHERE name = 'View tournament'`);
  });

  it('refuses a second player whose name only differs by case or padding', async () => {
    await dataSource.query(`INSERT INTO "player" ("playerName") VALUES ('Dando')`);
    await expect(dataSource.query(`INSERT INTO "player" ("playerName") VALUES ('  dando ')`)).rejects.toThrow(/UQ_player_normalized_name/);
    await dataSource.query(`INSERT INTO "player" ("playerName") VALUES ('Dandò')`);

    await dataSource.query(`DELETE FROM "player" WHERE LOWER(TRIM("playerName")) IN ('dando', 'dandò')`);
  });

  it('refuses a second participation of the same person in one tournament', async () => {
    await dataSource.query(`INSERT INTO "tournament" ("name") VALUES ('Participant uniqueness')`);
    await dataSource.query(`INSERT INTO "player" ("playerName") VALUES ('Twice registered')`);
    const insert = `INSERT INTO "participant" ("tournamentId", "playerId")
                    SELECT t."id", pl."id" FROM "tournament" t, "player" pl
                    WHERE t."name" = 'Participant uniqueness' AND pl."playerName" = 'Twice registered'`;

    await dataSource.query(insert);
    await expect(dataSource.query(insert)).rejects.toThrow(/UQ_participant_tournament_player/);

    const [participant] = await dataSource.query<Array<{ roles: string[] }>>(
      `SELECT "roles" FROM "participant" WHERE "playerId" = (SELECT "id" FROM "player" WHERE "playerName" = 'Twice registered')`,
    );
    expect(participant.roles).toEqual(['unknown']);

    await dataSource.query(`DELETE FROM "tournament" WHERE name = 'Participant uniqueness'`);
    await dataSource.query(`DELETE FROM "player" WHERE "playerName" = 'Twice registered'`);
  });

  describe('local fixture seed', () => {
    const name = 'Seeded fixture tournament';
    const environment = { ...process.env };

    beforeEach(() => {
      process.env.LOCAL_FIXTURE_TOURNAMENT_NAME = name;
      delete process.env.LOCAL_FIXTURE_SYNCSTART_URL;
    });

    afterEach(async () => {
      process.env = { ...environment };
      await dataSource.query(`DELETE FROM "tournament" WHERE name = $1`, [name]);
    });

    it('creates nothing unless the seed is explicitly enabled', async () => {
      delete process.env.LOCAL_FIXTURE_ENABLED;
      await seedLocalFixture(dataSource);
      process.env.LOCAL_FIXTURE_ENABLED = 'false';
      await seedLocalFixture(dataSource);

      const rows = await dataSource.query<Array<{ count: string }>>(`SELECT COUNT(*) AS count FROM "tournament" WHERE name = $1`, [name]);
      expect(rows[0].count).toBe('0');
    });

    it('creates the fixture once and leaves it alone when it already exists', async () => {
      process.env.LOCAL_FIXTURE_ENABLED = 'true';
      await seedLocalFixture(dataSource);

      const created = await dataSource.query<Array<{ id: number; syncstartUrl: string; availableSetupsCount: number; defaultScoringSystem: string }>>(
        `SELECT "id", "syncstartUrl", "availableSetupsCount", "defaultScoringSystem" FROM "tournament" WHERE name = $1`,
        [name],
      );
      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({ syncstartUrl: '', availableSetupsCount: 2, defaultScoringSystem: 'PlacementPointsWithFailZero' });

      await dataSource.query(`UPDATE "tournament" SET "availableSetupsCount" = 5 WHERE name = $1`, [name]);
      await seedLocalFixture(dataSource);

      const after = await dataSource.query<Array<{ id: number; availableSetupsCount: number }>>(
        `SELECT "id", "availableSetupsCount" FROM "tournament" WHERE name = $1`,
        [name],
      );
      expect(after).toEqual([{ id: created[0].id, availableSetupsCount: 5 }]);
    });
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
