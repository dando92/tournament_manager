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

const database = getTestDatabaseName('division_writes');

/* The application reads its database from the environment, and `setup-env.ts`
   restores that name for every spec file, so claiming one here isolates this
   suite without reaching into another. */
process.env.DATABASE_NAME = database;

type EntrantBody = {
  id: number;
  name: string;
  status: string;
  participants: Array<{ id: number; player: { id: number; playerName: string } }>;
};

/**
 * Every write a division undergoes, against a real PostgreSQL.
 *
 * The rules are unit-tested against the aggregate without a database. What only
 * a database can show is that the roster comes back the way it left — a
 * withdrawn entrant that keeps its id and its seed when the same person is
 * admitted again — and what each write announces, which is the half that
 * decides whether everybody else's screen moves. Admitting and withdrawing
 * somebody published nothing at all before this.
 */
describe('Division writes (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let phaseGroupQueries: PhaseGroupQueries;
  let accessToken: string;

  let tournamentId: number;
  let divisionId: number;
  const participantIdByName = new Map<string, number>();
  const published: EventEnvelope[] = [];

  /** The events one request published, in order. */
  async function announcedBy(send: () => request.Test): Promise<EventEnvelope[]> {
    published.length = 0;
    await send();

    return [...published];
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
      username: 'division-writes-owner',
      email: 'division-writes-owner@example.test',
      password: 'DivisionWritesPassword!',
      playerName: 'Division Writes Owner',
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
      .send({ name: 'Division Writes Tournament' })
      .expect(201);
    tournamentId = tournament.body.id;

    const division = await request(app.getHttpServer())
      .post('/divisions')
      .send({ name: 'Main Division', tournamentId })
      .expect(201);
    divisionId = division.body.id;

    for (const playerName of ['Ann', 'Bob', 'Cal']) {
      const participant = await request(app.getHttpServer())
        .post(`/tournaments/${tournamentId}/participants`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ playerName })
        .expect(201);
      participantIdByName.set(playerName, participant.body.id);
    }
  });

  afterAll(async () => {
    await app.close();
    await dropTestDatabase(database);
  });

  async function entrants(): Promise<EntrantBody[]> {
    const response = await request(app.getHttpServer()).get(`/divisions/${divisionId}/entrants`).expect(200);

    return response.body;
  }

  function admit(playerName: string): request.Test {
    return request(app.getHttpServer())
      .post(`/divisions/${divisionId}/participants/${participantIdByName.get(playerName)}`)
      .expect(201);
  }

  function withdraw(playerName: string): request.Test {
    return request(app.getHttpServer())
      .delete(`/divisions/${divisionId}/participants/${participantIdByName.get(playerName)}`)
      .expect(204);
  }

  it('announces the tournament when a division is created, and answers with its id', async () => {
    const events = await announcedBy(() =>
      request(app.getHttpServer()).post('/divisions').send({ name: 'Second Division', tournamentId }).expect(201),
    );

    expect(events.map((event) => event.type)).toEqual(['ui.tournament-changed']);
    expect(events[0].payload).toEqual({ tournamentId });
  });

  it('announces the division when it is renamed, without looking up where it sits', async () => {
    const events = await announcedBy(() =>
      request(app.getHttpServer()).patch(`/divisions/${divisionId}`).send({ name: 'Main Division' }).expect(204),
    );

    expect(events.map((event) => event.type)).toEqual(['ui.division-changed']);
    expect(events[0].payload).toEqual({ tournamentId, divisionId });
  });

  it('admits somebody, announces the division, and answers with the entrant id', async () => {
    const events = await announcedBy(() => admit('Ann'));
    const roster = await entrants();

    expect(events.map((event) => event.type)).toEqual(['ui.division-changed']);
    expect(events[0].payload).toEqual({ tournamentId, divisionId });
    expect(roster.map((entrant) => entrant.name)).toEqual(['Ann']);
    expect(roster[0].participants.map((participant) => participant.id)).toEqual([participantIdByName.get('Ann')]);
  });

  it('offers a participant again once they are withdrawn, and stops offering an admitted one', async () => {
    await admit('Bob');
    const admitted = await request(app.getHttpServer()).get(`/divisions/${divisionId}/available-participants`).expect(200);
    expect(admitted.body.map((participant: { player: { playerName: string } }) => participant.player.playerName)).toEqual([
      'Cal',
      'Division Writes Owner',
    ]);

    const events = await announcedBy(() => withdraw('Bob'));

    expect(events.map((event) => event.type)).toEqual(['ui.division-changed']);
    const available = await request(app.getHttpServer()).get(`/divisions/${divisionId}/available-participants`).expect(200);
    expect(
      available.body.map((participant: { player: { playerName: string } }) => participant.player.playerName),
    ).toEqual(['Bob', 'Cal', 'Division Writes Owner']);
  });

  /* The entrant carries what was played and how it was seeded, so admitting the
     same person again has to be the reversal of the withdrawal it follows. */
  it('gives a re-admitted participant the entrant they had, with its seed', async () => {
    const admitted = await admit('Cal');
    const calEntrantId = admitted.body.id;
    const annEntrantId = (await entrants()).find((entrant) => entrant.name === 'Ann')!.id;

    await request(app.getHttpServer())
      .patch(`/divisions/${divisionId}/entrants/seeding`)
      .send({ entrantIds: [calEntrantId, annEntrantId] })
      .expect(204);

    await withdraw('Cal');
    const readmitted = await admit('Cal');

    expect(readmitted.body.id).toBe(calEntrantId);
    /* Bob is here too, withdrawn: the roster keeps everybody it ever had. */
    const roster = await entrants();
    expect(roster.map((entrant) => entrant.name)).toEqual(['Cal', 'Ann', 'Bob']);
    expect(roster.filter((entrant) => entrant.status === 'active').map((entrant) => entrant.name)).toEqual(['Cal', 'Ann']);
  });

  it('announces the division when the seeding changes, and reads back in the new order', async () => {
    const roster = await entrants();
    const reversed = [...roster].reverse().map((entrant) => entrant.id);

    const events = await announcedBy(() =>
      request(app.getHttpServer())
        .patch(`/divisions/${divisionId}/entrants/seeding`)
        .send({ entrantIds: reversed })
        .expect(204),
    );

    expect(events.map((event) => event.type)).toEqual(['ui.division-changed']);
    expect((await entrants()).map((entrant) => entrant.id)).toEqual(reversed);
  });

  it('refuses a seeding that names an entrant of another division', async () => {
    await request(app.getHttpServer())
      .patch(`/divisions/${divisionId}/entrants/seeding`)
      .send({ entrantIds: [999999] })
      .expect(404);
  });

  /**
   * A command loads its aggregate once. Every load of the graph opens with the
   * distinct-id query TypeORM puts in front of a `findOne` that carries
   * relations, so counting those counts the loads. Withdrawing somebody used to
   * cost a query builder per entrant of the division and told nobody about it.
   */
  it('loads the division once to admit somebody and once to seed the roster', async () => {
    const countGraphLoadsOf = async (send: () => request.Test): Promise<number> => {
      const logger = dataSource.logger;
      let loads = 0;
      (dataSource as unknown as { logger: unknown }).logger = {
        ...logger,
        logQuery: (query: string) => {
          if (query.includes('"distinctAlias"."Division_id"')) loads += 1;
        },
      };

      try {
        await send();
      } finally {
        (dataSource as unknown as { logger: unknown }).logger = logger;
      }

      return loads;
    };

    await withdraw('Ann');
    expect(await countGraphLoadsOf(() => admit('Ann'))).toBe(1);

    const roster = await entrants();
    expect(
      await countGraphLoadsOf(() =>
        request(app.getHttpServer())
          .patch(`/divisions/${divisionId}/entrants/seeding`)
          .send({ entrantIds: roster.map((entrant) => entrant.id) })
          .expect(204),
      ),
    ).toBe(1);
  });

  describe('generating a bracket', () => {
    let bracketDivisionId: number;

    beforeAll(async () => {
      const division = await request(app.getHttpServer())
        .post('/divisions')
        .send({ name: 'Bracket Division', tournamentId })
        .expect(201);
      bracketDivisionId = division.body.id;
    });

    it('refuses to build one for a division nobody competes in', async () => {
      await request(app.getHttpServer())
        .post(`/divisions/${bracketDivisionId}/generate-bracket`)
        .send({ bracketType: 'SingleElimination' })
        .expect(400);
    });

    it('refuses a bracket type no system implements', async () => {
      await request(app.getHttpServer())
        .post(`/divisions/${divisionId}/generate-bracket`)
        .send({ bracketType: 'NoSuchSystem' })
        .expect(400);
    });

    /* The first round takes its entrants in the order the division seeded them,
       which is what the seeding page is for. */
    it('answers with the phase and pool it built, and seats the entrants in seeded order', async () => {
      /* Only the people still competing are seated: a withdrawn entrant stays
         on the roster and out of the bracket. */
      const seeded = (await entrants()).filter((entrant) => entrant.status === 'active').map((entrant) => entrant.id);

      const generated = await request(app.getHttpServer())
        .post(`/divisions/${divisionId}/generate-bracket`)
        .send({ bracketType: 'SingleElimination', phaseName: 'Finals', playerPerMatch: 2 })
        .expect(201);

      expect(generated.body).toEqual({ phaseId: expect.any(Number), phaseGroupId: expect.any(Number) });

      const seats = await phaseGroupQueries.entrants(generated.body.phaseGroupId);
      expect(seats.map((seat) => seat.entrant.id)).toEqual(seeded);

      const matches = await request(app.getHttpServer())
        .get(`/matches/phase-group/${generated.body.phaseGroupId}`)
        .expect(200);
      expect(matches.body.length).toBeGreaterThan(0);
      expect(matches.body[0].entrants.map((entrant: { id: number }) => entrant.id)).toEqual(seeded);
    });
  });
});
