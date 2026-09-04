import { DataSource } from 'typeorm';
import { createMigrationDataSource } from '../src/migration-data-source';
import { seedLocalFixture } from '../src/seed-local-fixture';
import { TournamentTimelineTiming1788300000000 } from '../src/migrations/1788300000000-TournamentTimelineTiming';
import { MatchState1788900000000 } from '../src/migrations/1788900000000-MatchState';
import { ScheduleWithoutPause1789000000000 } from '../src/migrations/1789000000000-ScheduleWithoutPause';

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

  /**
   * The backfill of `match."state"`, over rows that predate the column.
   *
   * The column is written by the application from `MatchAggregate.state`, so the
   * only thing the migration decides on its own is where the matches already
   * stored start. It classifies them with the two SQL predicates it retires, and
   * this exercises all four values it can produce by dropping the column and
   * adding it back over a tournament that holds one match of each kind.
   */
  it('backfills the state of the matches it finds', async () => {
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    const inserted = async (sql: string, params: unknown[] = []): Promise<number> => {
      const [row] = (await runner.query(sql, params)) as unknown as Array<{ id: number }>;

      return row.id;
    };

    try {
      const tournamentId = await inserted(`INSERT INTO "tournament" ("name") VALUES ('Backfill tournament') RETURNING "id"`);
      const divisionId = await inserted(`INSERT INTO "division" ("name", "tournamentId") VALUES ('Backfill division', $1) RETURNING "id"`, [tournamentId]);
      const phaseId = await inserted(`INSERT INTO "phase" ("name", "divisionId") VALUES ('Backfill phase', $1) RETURNING "id"`, [divisionId]);
      const poolId = await inserted(`INSERT INTO "phase_group" ("name", "phaseId") VALUES ('Backfill pool', $1) RETURNING "id"`, [phaseId]);
      const songId = await inserted(
        `INSERT INTO "song" ("title", "artist", "group", "difficulty", "tournamentId") VALUES ('Backfill song', 'Writer', 'Test', 9, $1) RETURNING "id"`,
        [tournamentId],
      );

      const playerIds: number[] = [];
      const entrantIds: number[] = [];
      for (const name of ['Backfill One', 'Backfill Two']) {
        const playerId = await inserted(`INSERT INTO "player" ("playerName") VALUES ($1) RETURNING "id"`, [name]);
        const participantId = await inserted(`INSERT INTO "participant" ("tournamentId", "playerId") VALUES ($1, $2) RETURNING "id"`, [tournamentId, playerId]);
        const entrantId = await inserted(`INSERT INTO "entrant" ("name", "divisionId") VALUES ($1, $2) RETURNING "id"`, [name, divisionId]);
        await runner.query(`INSERT INTO "entrant_participants_participant" ("entrantId", "participantId") VALUES ($1, $2)`, [entrantId, participantId]);
        playerIds.push(playerId);
        entrantIds.push(entrantId);
      }

      const matchOf = async (name: string): Promise<number> => {
        const matchId = await inserted(
          `INSERT INTO "match" ("name", "scoringSystem", "phaseGroupId") VALUES ($1, 'PlacementPointsWithFailZero', $2) RETURNING "id"`,
          [name, poolId],
        );
        for (const entrantId of entrantIds) {
          await runner.query(`INSERT INTO "match_entrants_entrant" ("matchId", "entrantId") VALUES ($1, $2)`, [matchId, entrantId]);
        }

        return matchId;
      };

      await matchOf('Backfill untouched');

      /* One of the two players has played the song, so the match carries
         evidence and is still waiting for the other. */
      const partialId = await matchOf('Backfill partial');
      const partialRoundId = await inserted(`INSERT INTO "round" ("matchId", "songId") VALUES ($1, $2) RETURNING "id"`, [partialId, songId]);
      const scoreId = await inserted(
        `INSERT INTO "score" ("percentage", "isFailed", "songId", "playerId") VALUES (99, false, $1, $2) RETURNING "id"`,
        [songId, playerIds[0]],
      );
      await runner.query(`INSERT INTO "standing" ("roundId", "playerId", "scoreId", "points") VALUES ($1, $2, $3, 0)`, [partialRoundId, playerIds[0], scoreId]);

      /* A hand-scored round settles as soon as somebody has a point. */
      const settledId = await matchOf('Backfill settled');
      const settledRoundId = await inserted(`INSERT INTO "round" ("matchId") VALUES ($1) RETURNING "id"`, [settledId]);
      await runner.query(`INSERT INTO "standing" ("roundId", "playerId", "points") VALUES ($1, $2, 3)`, [settledRoundId, playerIds[0]]);

      const completedId = await matchOf('Backfill completed');
      const resultId = await inserted(`INSERT INTO "match_result" ("playerPoints") VALUES ('[]'::jsonb) RETURNING "id"`);
      await runner.query(`UPDATE "match" SET "matchResultId" = $1 WHERE "id" = $2`, [resultId, completedId]);

      const migration = new MatchState1788900000000();
      await migration.down(runner);
      await migration.up(runner);

      const states = await runner.query(`SELECT "name", "state" FROM "match" WHERE "phaseGroupId" = $1 ORDER BY "id"`, [poolId]);
      expect(states).toEqual([
        { name: 'Backfill untouched', state: 'open' },
        { name: 'Backfill partial', state: 'partial' },
        { name: 'Backfill settled', state: 'ready' },
        { name: 'Backfill completed', state: 'completed' },
      ]);
    } finally {
      /* The two join tables are cleared first: neither cascades from the rows
         the tournament takes with it. */
      const backfillEntrants = `SELECT "id" FROM "entrant" WHERE "name" IN ('Backfill One', 'Backfill Two')`;
      await runner.query(`DELETE FROM "entrant_participants_participant" WHERE "entrantId" IN (${backfillEntrants})`);
      await runner.query(`DELETE FROM "match_entrants_entrant" WHERE "entrantId" IN (${backfillEntrants})`);
      await runner.query(`DELETE FROM "entrant" WHERE "name" IN ('Backfill One', 'Backfill Two')`);
      await runner.query(`DELETE FROM "tournament" WHERE "name" = 'Backfill tournament'`);
      await runner.query(`DELETE FROM "match_result" mr WHERE NOT EXISTS (SELECT 1 FROM "match" m WHERE m."matchResultId" = mr."id")`);
      await runner.query(`DELETE FROM "player" WHERE "playerName" IN ('Backfill One', 'Backfill Two')`);
      await runner.query(`DELETE FROM "song" WHERE "title" = 'Backfill song'`);
      await runner.release();
    }
  });
  /**
   * The removal of the paused state.
   *
   * A paused schedule kept its match active while owning nothing, so the
   * migration has to take that match out of the active state as it normalizes
   * the row: after it, no schedule would ever switch it off. The old constraint
   * is restored first, because a paused row cannot be written under the new one.
   */
  it('normalizes paused schedules and takes their matches out of the active state', async () => {
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    const inserted = async (sql: string, params: unknown[] = []): Promise<number> => {
      const [row] = (await runner.query(sql, params)) as unknown as Array<{ id: number }>;

      return row.id;
    };

    try {
      const tournamentId = await inserted(`INSERT INTO "tournament" ("name") VALUES ('Pause tournament') RETURNING "id"`);
      const divisionId = await inserted(`INSERT INTO "division" ("name", "tournamentId") VALUES ('Pause division', $1) RETURNING "id"`, [tournamentId]);
      const phaseId = await inserted(`INSERT INTO "phase" ("name", "divisionId") VALUES ('Pause phase', $1) RETURNING "id"`, [divisionId]);
      const poolId = await inserted(`INSERT INTO "phase_group" ("name", "phaseId") VALUES ('Pause pool', $1) RETURNING "id"`, [phaseId]);
      const matchId = await inserted(
        `INSERT INTO "match" ("name", "scoringSystem", "phaseGroupId", "active") VALUES ('Paused match', 'PlacementPointsWithFailZero', $1, TRUE) RETURNING "id"`,
        [poolId],
      );

      const migration = new ScheduleWithoutPause1789000000000();
      await migration.down(runner);
      const scheduleId = await inserted(
        `INSERT INTO "schedule" ("name", "willStartAt", "status", "version", "tournamentId") VALUES ('Paused schedule', now(), 'paused', 1, $1) RETURNING "id"`,
        [tournamentId],
      );
      await runner.query(
        `INSERT INTO "schedule_entry" ("position", "expectedDurationMinutes", "scheduleId", "matchId") VALUES (0, 30, $1, $2)`,
        [scheduleId, matchId],
      );

      await migration.up(runner);

      const [schedule] = await runner.query(`SELECT "status" FROM "schedule" WHERE "id" = $1`, [scheduleId]);
      const [match] = await runner.query(`SELECT "active" FROM "match" WHERE "id" = $1`, [matchId]);
      expect(schedule).toEqual({ status: 'inactive' });
      expect(match).toEqual({ active: false });
      await expect(
        runner.query(`UPDATE "schedule" SET "status" = 'paused' WHERE "id" = $1`, [scheduleId]),
      ).rejects.toThrow(/CHK_schedule_status/);
    } finally {
      await runner.query(`DELETE FROM "tournament" WHERE "name" = 'Pause tournament'`);
      await runner.release();
    }
  });
});
