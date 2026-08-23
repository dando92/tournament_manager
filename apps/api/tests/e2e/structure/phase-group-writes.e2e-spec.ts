import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { DataSource, Repository } from 'typeorm';

import { AppModule } from '../../../src/app.module';
import { Account } from '@tournament-manager/persistence';
import { LIVE_EVENT_PUBLISHER } from '@tournament-manager/live-messaging';
import type { EventEnvelope } from '@tournament-manager/live-messaging';
import { TournamentSyncStartService } from '../../../src/tournament/syncstart/tournament-syncstart.service';
import { PhaseGroupQueries } from '../../../src/tournament/structure/phase-group/phase-group.queries';
import {
  dropTestDatabase,
  getTestDatabaseName,
  resetMigratedTestDatabase,
} from '../../support/postgres-test-database';

const database = getTestDatabaseName('phase_group_writes');

process.env.DATABASE_NAME = database;

/**
 * Every write a pool undergoes, against a real PostgreSQL.
 *
 * The rules are unit-tested against the aggregate without a database. What only
 * a database can show is who a pool says is competing in it — a seat it decided
 * on, or somebody a match of this pool holds, which used to be a copied row and
 * is now derived by the query — and what each write announces, which is the
 * half that decides whether everybody else's screen moves.
 */
describe('Phase group writes (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let phaseGroupQueries: PhaseGroupQueries;
  let accessToken: string;

  let tournamentId: number;
  let divisionId: number;
  let phaseId: number;
  let defaultPoolId: number;
  const entrantIdByName = new Map<string, number>();
  const published: EventEnvelope[] = [];

  /** The events one request published, in order. */
  async function announcedBy(send: () => request.Test): Promise<EventEnvelope[]> {
    published.length = 0;
    await send();

    return [...published];
  }

  /* Nothing calls a pool's roster over HTTP, so the route was removed with the
     other reads no client makes. The query is what the pool answers with, and it
     is what this suite asserts through. */
  function seats(phaseGroupId: number) {
    return phaseGroupQueries.entrants(phaseGroupId);
  }

  async function createMatch(phaseGroupId: number, entrantIds: number[]): Promise<number> {
    const match = await request(app.getHttpServer())
      .post('/matches')
      .send({ name: 'Set 1', phaseGroupId, scoringSystem: 'PlacementPointsWithFailZero', entrantIds })
      .expect(201);

    return match.body.id;
  }

  beforeAll(async () => {
    const migrations = await resetMigratedTestDatabase(database);
    await migrations.destroy();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LIVE_EVENT_PUBLISHER)
      .useValue({
        publish: (event: EventEnvelope) => {
          published.push(event);

          return Promise.resolve();
        },
      })
      .overrideProvider(TournamentSyncStartService)
      .useValue({
        configureTournament: jest.fn().mockResolvedValue(undefined),
        closeTournament: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    phaseGroupQueries = moduleFixture.get(PhaseGroupQueries);
    const accountRepository = moduleFixture.get<Repository<Account>>(getRepositoryToken(Account));
    const credentials = {
      username: 'phase-group-writes-owner',
      email: 'phase-group-writes-owner@example.test',
      password: 'PhaseGroupWritesPassword!',
      playerName: 'Phase Group Writes Owner',
    };

    await request(app.getHttpServer()).post('/user').send(credentials).expect(201);
    const account = await accountRepository.findOneByOrFail({ username: credentials.username });
    account.isTournamentCreator = true;
    await accountRepository.save(account);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: credentials.username, password: credentials.password })
      .expect(201);
    accessToken = login.body.access_token;

    const tournament = await request(app.getHttpServer())
      .post('/tournaments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Phase Group Writes Tournament' })
      .expect(201);
    tournamentId = tournament.body.id;

    const division = await request(app.getHttpServer())
      .post('/divisions')
      .send({ name: 'Main Division', tournamentId })
      .expect(201);
    divisionId = division.body.id;

    for (const playerName of ['Ann', 'Bob']) {
      const participant = await request(app.getHttpServer())
        .post(`/tournaments/${tournamentId}/participants`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ playerName })
        .expect(201);
      const entrant = await request(app.getHttpServer())
        .post(`/divisions/${divisionId}/participants/${participant.body.id}`)
        .expect(201);
      entrantIdByName.set(playerName, entrant.body.id);
    }

    const phase = await request(app.getHttpServer())
      .post('/phases')
      .send({ name: 'Qualifiers', divisionId })
      .expect(201);
    phaseId = phase.body.id;

    /* Creating a phase gives it a default pool, which is the one every test
       below that does not make its own works in. */
    const pools = await request(app.getHttpServer()).get(`/divisions/${divisionId}/summary`).expect(200);
    defaultPoolId = pools.body.phases[0].phaseGroups[0].id;
  });

  afterAll(async () => {
    await app.close();
    await dropTestDatabase(database);
  });

  it('announces the phase and the pool when one is created, and answers with its id', async () => {
    const events = await announcedBy(() =>
      request(app.getHttpServer()).post(`/phases/${phaseId}/phase-groups`).send({}).expect(201),
    );

    expect(events.map((event) => event.type)).toEqual(['ui.phase-changed', 'ui.phase-group-changed']);
    expect(events[0].payload).toEqual({ tournamentId, divisionId, phaseId });
    expect(events[1].payload).toEqual({ tournamentId, divisionId, phaseId, phaseGroupId: expect.any(Number) });
  });

  it('gives a new pool the first letter its phase does not already use', async () => {
    const created = await request(app.getHttpServer()).post(`/phases/${phaseId}/phase-groups`).send({}).expect(201);

    const summary = await request(app.getHttpServer()).get(`/divisions/${divisionId}/summary`).expect(200);
    const pool = summary.body.phases
      .flatMap((phase: { phaseGroups: Array<{ id: number; displayIdentifier: string }> }) => phase.phaseGroups)
      .find((candidate: { id: number }) => candidate.id === created.body.id);

    expect(pool.displayIdentifier).toBe('C');
    expect(pool.name).toBe('C');
  });

  it('announces the phase and the pool when one is renamed', async () => {
    const events = await announcedBy(() =>
      request(app.getHttpServer()).patch(`/phase-groups/${defaultPoolId}`).send({ name: 'Pool A' }).expect(204),
    );

    expect(events.map((event) => event.type)).toEqual(['ui.phase-changed', 'ui.phase-group-changed']);
    expect(events[1].payload).toEqual({ tournamentId, divisionId, phaseId, phaseGroupId: defaultPoolId });
  });

  it('announces the phase when a pool is deleted, and refuses a second delete of the same one', async () => {
    const created = await request(app.getHttpServer()).post(`/phases/${phaseId}/phase-groups`).send({}).expect(201);

    const events = await announcedBy(() =>
      request(app.getHttpServer()).delete(`/phase-groups/${created.body.id}`).expect(204),
    );
    expect(events.map((event) => event.type)).toEqual(['ui.phase-changed']);

    /* The guard that checks whether the tournament is still open cannot find
       the pool the second time, so the request never reaches the command. */
    const again = await announcedBy(() =>
      request(app.getHttpServer()).delete(`/phase-groups/${created.body.id}`).expect(404),
    );
    expect(again).toEqual([]);
  });

  /**
   * Who competes in a pool is two things, and only one of them is a row. A
   * match of this pool holding somebody is the other, and it is derived at read
   * time: no match write copies it into a seat, and nothing has to keep the
   * copy in step.
   */
  it('reads an entrant a match introduced without seating them, and drops them with the match', async () => {
    const matchId = await createMatch(defaultPoolId, [entrantIdByName.get('Ann')]);

    const derived = await seats(defaultPoolId);
    expect(derived).toEqual([
      expect.objectContaining({ seedNum: null, slot: null, status: 'active', entrant: expect.objectContaining({ name: 'Ann' }) }),
    ]);

    await request(app.getHttpServer()).delete(`/matches/${matchId}`).expect(204);
    expect(await seats(defaultPoolId)).toEqual([]);
  });

  it('creating a match in a pool announces the pool and writes nothing into it', async () => {
    const events = await announcedBy(() =>
      request(app.getHttpServer())
        .post('/matches')
        .send({
          name: 'Set 2',
          phaseGroupId: defaultPoolId,
          scoringSystem: 'PlacementPointsWithFailZero',
          entrantIds: [entrantIdByName.get('Bob')],
        })
        .expect(201),
    );

    expect(events.map((event) => event.type)).toEqual(['ui.phase-group-changed']);
    const rows = await dataSource.query('SELECT COUNT(*)::int AS "count" FROM "phase_group_entrant" WHERE "phaseGroupId" = $1', [
      defaultPoolId,
    ]);
    expect(rows[0].count).toBe(0);
  });

  /**
   * A generated bracket is the write that does seat people, and the seats are
   * what the pool decided: the order the division seeded them in.
   */
  it('seats the entrants a generated bracket puts in a pool', async () => {
    const generated = await request(app.getHttpServer())
      .post(`/divisions/${divisionId}/generate-bracket`)
      .send({ bracketType: 'SingleElimination', phaseName: 'Finals', playerPerMatch: 2 })
      .expect(201);

    const seated = await seats(generated.body.phaseGroupId);
    expect(seated.map((seat) => [seat.entrant.name, Number(seat.seedNum), Number(seat.slot)])).toEqual([
      ['Ann', 1, 1],
      ['Bob', 2, 2],
    ]);
  });

  /**
   * An advancement rule is an edge between two competitions rather than a part
   * of either, so it has no aggregate to load and no address in hand. It still
   * has to announce the pool its source sits in: the tree draws the rules
   * leaving each pool and the match list draws the ones leaving each match, and
   * until this the interface re-read both by hand after writing one.
   */
  it('announces the pool a rule leaves, whether the rule leaves a match or the pool itself', async () => {
    const sourceMatchId = await createMatch(defaultPoolId, [entrantIdByName.get('Ann')]);
    const targetPool = await request(app.getHttpServer()).post(`/phases/${phaseId}/phase-groups`).send({}).expect(201);

    const fromMatch = await announcedBy(() =>
      request(app.getHttpServer())
        .put(`/advancement-rules/sources/match/${sourceMatchId}`)
        .send({ rules: [{ sourcePlacement: 1, targetKind: 'phase_group', targetId: targetPool.body.id, targetSlot: 1 }] })
        .expect(204),
    );
    expect(fromMatch.map((event) => event.type)).toEqual(['ui.phase-group-changed']);
    expect(fromMatch[0].payload).toEqual({ tournamentId, divisionId, phaseId, phaseGroupId: defaultPoolId });

    const fromPool = await announcedBy(() =>
      request(app.getHttpServer())
        .put(`/advancement-rules/sources/phase_group/${defaultPoolId}`)
        .send({ rules: [{ sourcePlacement: 1, targetKind: 'phase_group', targetId: targetPool.body.id, targetSlot: 1 }] })
        .expect(204),
    );
    expect(fromPool.map((event) => event.type)).toEqual(['ui.phase-group-changed']);
    expect(fromPool[0].payload).toEqual({ tournamentId, divisionId, phaseId, phaseGroupId: defaultPoolId });

    await request(app.getHttpServer()).delete(`/matches/${sourceMatchId}`).expect(204);
  });

  it('answers 404 for a rule whose source pool does not exist', async () => {
    await request(app.getHttpServer())
      .put('/advancement-rules/sources/phase_group/999999')
      .send({ rules: [] })
      .expect(404);
  });

  /**
   * A command loads its aggregate once. Every load of the graph opens with the
   * distinct-id query TypeORM puts in front of a `findOne` that carries
   * relations, so counting those counts the loads.
   */
  it('loads the pool once to rename it', async () => {
    const logger = dataSource.logger;
    let loads = 0;
    (dataSource as unknown as { logger: unknown }).logger = {
      ...logger,
      logQuery: (query: string) => {
        if (query.includes('"distinctAlias"."PhaseGroup_id"')) loads += 1;
      },
    };

    try {
      await request(app.getHttpServer()).patch(`/phase-groups/${defaultPoolId}`).send({ name: 'Pool A' }).expect(204);
    } finally {
      (dataSource as unknown as { logger: unknown }).logger = logger;
    }

    expect(loads).toBe(1);
  });
});
