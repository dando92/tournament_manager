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
import {
  dropTestDatabase,
  getTestDatabaseName,
  resetMigratedTestDatabase,
} from '../../support/postgres-test-database';

const database = getTestDatabaseName('tournament_writes');

process.env.DATABASE_NAME = database;

type ParticipantBody = {
  id: number;
  roles: string[];
  status: string;
  player: { id: number; playerName: string };
};

/**
 * Every write a tournament undergoes, against a real PostgreSQL.
 *
 * The rules are unit-tested against the aggregate without a database. What only
 * a database can show is that registering the same person twice leaves one
 * participant, that removing one takes their entrants out of the divisions
 * first, and what each write announces — which is the half that decides whether
 * everybody else's screen moves. A tournament announced nothing at all before
 * this: renaming one, or closing it, moved for whoever did it and for nobody
 * else.
 */
describe('Tournament writes (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let accessToken: string;
  const configureTournament = jest.fn().mockResolvedValue(undefined);
  const closeTournament = jest.fn().mockResolvedValue(undefined);

  let tournamentId: number;
  const published: EventEnvelope[] = [];

  /** The events one request published, in order. */
  async function announcedBy(send: () => request.Test): Promise<EventEnvelope[]> {
    published.length = 0;
    await send();

    return [...published];
  }

  function authorized(test: request.Test): request.Test {
    return test.set('Authorization', `Bearer ${accessToken}`);
  }

  async function participants(): Promise<ParticipantBody[]> {
    const response = await authorized(
      request(app.getHttpServer()).get(`/tournaments/${tournamentId}/participants`),
    ).expect(200);

    return response.body;
  }

  async function register(body: { playerName?: string; playerId?: number }): Promise<number> {
    const response = await authorized(
      request(app.getHttpServer()).post(`/tournaments/${tournamentId}/participants`).send(body),
    ).expect(201);

    return response.body.id;
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
      .useValue({ configureTournament, closeTournament })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    const accountRepository = moduleFixture.get<Repository<Account>>(getRepositoryToken(Account));
    const credentials = {
      username: 'tournament-writes-owner',
      email: 'tournament-writes-owner@example.test',
      password: 'TournamentWritesPassword!',
      playerName: 'Tournament Writes Owner',
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
  });

  afterAll(async () => {
    await app.close();
    await dropTestDatabase(database);
  });

  it('answers with the id of the tournament it made, registers its creator as owner, and tells SyncStart where it lives', async () => {
    configureTournament.mockClear();

    const created = await authorized(
      request(app.getHttpServer()).post('/tournaments').send({ name: 'Main Tournament' }),
    ).expect(201);
    tournamentId = created.body.id;

    expect(created.body).toEqual({ id: expect.any(Number) });
    expect(configureTournament).toHaveBeenCalledWith(tournamentId, expect.any(String));

    const roster = await participants();
    expect(roster).toEqual([
      expect.objectContaining({
        roles: ['owner'],
        player: expect.objectContaining({ playerName: 'Tournament Writes Owner' }),
      }),
    ]);
  });

  it('announces the tournament when it is renamed', async () => {
    const events = await announcedBy(() =>
      authorized(request(app.getHttpServer()).patch(`/tournaments/${tournamentId}`).send({ name: 'Renamed' })).expect(204),
    );

    expect(events.map((event) => event.type)).toEqual(['ui.tournament-changed']);
    expect(events[0].payload).toEqual({ tournamentId });
  });

  /* Reconfiguring SyncStart is the consequence of the URL changing rather than
     of the request naming it, which is what the controller used to decide by
     asking the write for the value it replaced. */
  it('tells SyncStart only when the URL actually moved', async () => {
    configureTournament.mockClear();
    await authorized(
      request(app.getHttpServer()).patch(`/tournaments/${tournamentId}`).send({ name: 'Renamed again' }),
    ).expect(204);
    expect(configureTournament).not.toHaveBeenCalled();

    await authorized(
      request(app.getHttpServer()).patch(`/tournaments/${tournamentId}`).send({ syncstartUrl: 'ws://elsewhere.test' }),
    ).expect(204);
    expect(configureTournament).toHaveBeenCalledWith(tournamentId, 'ws://elsewhere.test');
  });

  it('registers somebody by name and answers with the participant id', async () => {
    const participantId = await register({ playerName: 'Ann' });

    expect(await participants()).toContainEqual(
      expect.objectContaining({ id: participantId, roles: ['competitor'], player: expect.objectContaining({ playerName: 'Ann' }) }),
    );
  });

  /* One person is one participant of one tournament, however many ways there
     are to say so: by name, by player, or through an import. */
  it('registers the same person twice as one participant', async () => {
    const first = await register({ playerName: 'Bob' });
    const again = await register({ playerName: '  bob  ' });

    expect(again).toBe(first);
    expect((await participants()).filter((each) => each.player.playerName === 'Bob')).toHaveLength(1);
  });

  it('refuses a registration that names nobody', async () => {
    await authorized(request(app.getHttpServer()).post(`/tournaments/${tournamentId}/participants`).send({})).expect(400);
  });

  it('grants and revokes a staff role, leaving somebody with no role as unknown', async () => {
    const participantId = await register({ playerName: 'Cal' });

    await authorized(
      request(app.getHttpServer()).post(`/tournaments/${tournamentId}/participants/${participantId}/staff`),
    ).expect(204);
    expect((await participants()).find((each) => each.id === participantId).roles).toEqual(['competitor', 'staff']);

    await authorized(
      request(app.getHttpServer()).delete(`/tournaments/${tournamentId}/participants/${participantId}/staff`),
    ).expect(204);
    expect((await participants()).find((each) => each.id === participantId).roles).toEqual(['competitor']);
  });

  /**
   * An entrant is the division's record of somebody, so the division withdraws
   * them and announces it; only then does the participant row go. The division
   * event updates its entrants, and the tournament event updates the roster.
   */
  it('takes somebody out of the divisions they competed in before unregistering them', async () => {
    const participantId = await register({ playerName: 'Dee' });
    const division = await authorized(
      request(app.getHttpServer()).post('/divisions').send({ name: 'Main Division', tournamentId }),
    ).expect(201);
    await request(app.getHttpServer())
      .post(`/divisions/${division.body.id}/participants/${participantId}`)
      .expect(201);

    const events = await announcedBy(() =>
      authorized(
        request(app.getHttpServer()).delete(`/tournaments/${tournamentId}/participants/${participantId}`),
      ).expect(204),
    );

    expect(events.map((event) => event.type)).toEqual([
      'ui.division-changed',
      'ui.tournament-changed',
    ]);
    expect(await participants()).not.toContainEqual(expect.objectContaining({ id: participantId }));

    /* The entrant stays and is withdrawn, because the matches it played point
       at it. What it does not keep is the participant, which left with the
       registration; the branch that lets a withdrawal free its participant is
       what decides whether that is right. */
    const entrants = await request(app.getHttpServer()).get(`/divisions/${division.body.id}/entrants`).expect(200);
    expect(entrants.body).toEqual([
      expect.objectContaining({ name: 'Dee', status: 'withdrawn', participants: [] }),
    ]);
  });

  it('says nothing when the person to unregister is not there', async () => {
    const events = await announcedBy(() =>
      authorized(request(app.getHttpServer()).delete(`/tournaments/${tournamentId}/participants/999999`)).expect(204),
    );

    expect(events).toEqual([]);
  });

  /**
   * A command loads its aggregate once. Every load of the graph opens with the
   * distinct-id query TypeORM puts in front of a `findOne` that carries
   * relations, so counting those counts the loads. An import of five people
   * used to cost a query and a save each.
   */
  it('registers a whole imported list in one load of the tournament', async () => {
    const names = ['Eve', 'Fay', 'Gus', 'Hal', 'Ivy'];
    const logger = dataSource.logger;
    let loads = 0;
    (dataSource as unknown as { logger: unknown }).logger = {
      ...logger,
      logQuery: (query: string) => {
        if (query.includes('"distinctAlias"."Tournament_id"')) loads += 1;
      },
    };

    let imported: request.Response;
    try {
      imported = await authorized(
        request(app.getHttpServer())
          .post(`/tournaments/${tournamentId}/participants/import`)
          .send({ entries: names.map((name) => ({ name })) }),
      ).expect(201);
    } finally {
      (dataSource as unknown as { logger: unknown }).logger = logger;
    }

    expect(imported.body).toHaveLength(names.length);
    expect(loads).toBe(1);
    const roster = (await participants()).map((each) => each.player.playerName);
    expect(names.every((name) => roster.includes(name))).toBe(true);
  });

  it('announces a tournament that closes, and nothing for one that was closed already', async () => {
    closeTournament.mockClear();

    const events = await announcedBy(() =>
      authorized(request(app.getHttpServer()).post(`/tournaments/${tournamentId}/close`)).expect(204),
    );
    expect(events.map((event) => event.type)).toEqual(['ui.tournament-changed']);

    const again = await announcedBy(() =>
      authorized(request(app.getHttpServer()).post(`/tournaments/${tournamentId}/close`)).expect(204),
    );
    expect(again).toEqual([]);
    /* SyncStart is told either way: a lobby it still holds is the state being
       corrected, whatever the row already said. */
    expect(closeTournament).toHaveBeenCalledTimes(2);
  });

  it('refuses a change to a closed tournament, and takes it once it is reopened', async () => {
    await authorized(request(app.getHttpServer()).patch(`/tournaments/${tournamentId}`).send({ name: 'Nope' })).expect(409);

    const events = await announcedBy(() =>
      authorized(request(app.getHttpServer()).post(`/tournaments/${tournamentId}/reopen`)).expect(204),
    );
    expect(events.map((event) => event.type)).toEqual(['ui.tournament-changed']);

    await authorized(request(app.getHttpServer()).patch(`/tournaments/${tournamentId}`).send({ name: 'Reopened' })).expect(204);
  });
});
