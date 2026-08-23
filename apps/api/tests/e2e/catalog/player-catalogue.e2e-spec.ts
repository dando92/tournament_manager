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

const database = getTestDatabaseName('player_catalogue');

process.env.DATABASE_NAME = database;

/**
 * The player catalogue, and the writes that create people in it.
 *
 * A player belongs to the application rather than to a tournament, and nothing
 * creates one on purpose: they appear because somebody was registered, imported
 * or pasted into a division. What a database is needed for is that the same
 * person is recognised as the same person however their name was typed, and
 * that a pasted list of any length costs one lookup and one insert.
 */
describe('Player catalogue (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let accessToken: string;

  let tournamentId: number;
  let divisionId: number;

  async function playerNames(): Promise<string[]> {
    const players = await request(app.getHttpServer()).get('/players').expect(200);

    return players.body.map((player: { playerName: string }) => player.playerName);
  }

  async function entrantNames(): Promise<string[]> {
    const entrants = await request(app.getHttpServer()).get(`/divisions/${divisionId}/entrants`).expect(200);

    return entrants.body.map((entrant: { name: string }) => entrant.name);
  }

  /** Every statement one request issues, which is what "one lookup" has to mean. */
  async function statementsOf(send: () => request.Test): Promise<string[]> {
    const logger = dataSource.logger;
    const statements: string[] = [];
    (dataSource as unknown as { logger: unknown }).logger = {
      ...logger,
      logQuery: (query: string) => statements.push(query),
    };

    try {
      await send();
    } finally {
      (dataSource as unknown as { logger: unknown }).logger = logger;
    }

    return statements;
  }

  const touching = (statements: string[], table: string): string[] =>
    statements.filter((statement) => statement.includes(`"${table}"`));

  beforeAll(async () => {
    const migrations = await resetMigratedTestDatabase(database);
    await migrations.destroy();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LIVE_EVENT_PUBLISHER)
      .useValue({ publish: (_event: EventEnvelope) => Promise.resolve() })
      .overrideProvider(TournamentSyncStartService)
      .useValue({
        configureTournament: jest.fn().mockResolvedValue(undefined),
        closeTournament: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    const accountRepository = moduleFixture.get<Repository<Account>>(getRepositoryToken(Account));
    const credentials = {
      username: 'player-catalogue-owner',
      email: 'player-catalogue-owner@example.test',
      password: 'PlayerCataloguePassword!',
      playerName: 'Player Catalogue Owner',
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
      .send({ name: 'Player Catalogue Tournament' })
      .expect(201);
    tournamentId = tournament.body.id;

    const division = await request(app.getHttpServer())
      .post('/divisions')
      .send({ name: 'Main Division', tournamentId })
      .expect(201);
    divisionId = division.body.id;
  });

  afterAll(async () => {
    await app.close();
    await dropTestDatabase(database);
  });

  it('answers with the name and nothing else, in the order the names read', async () => {
    await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/participants`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ playerName: 'Zoe' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/participants`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ playerName: 'Ann' })
      .expect(201);

    const players = await request(app.getHttpServer()).get('/players').expect(200);

    expect(players.body).toContainEqual({ id: expect.any(Number), playerName: 'Ann' });
    expect(players.body.every((player: object) => Object.keys(player).length === 2)).toBe(true);
    expect(await playerNames()).toEqual(['Ann', 'Player Catalogue Owner', 'Zoe']);
  });

  it('registers the person the catalogue already holds when a name is typed again', async () => {
    const before = (await playerNames()).length;

    await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/participants`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ playerName: '  ann  ' })
      .expect(201);

    expect((await playerNames()).length).toBe(before);
  });

  /**
   * The bulk add used to lowercase every name it was given: it matched the
   * catalogue on the lowercased form, so it only ever recognised people whose
   * stored name was lowercase, and anybody it created was created in lower
   * case. See FQ-022.
   */
  it('matches a pasted name against the catalogue however it was capitalized', async () => {
    const added = await request(app.getHttpServer())
      .post(`/players/divisions/${divisionId}/bulk`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ playerNames: ['ANN', 'Bea Ryder'] })
      .expect(201);

    expect(added.body.warnings).toEqual(['ANN']);
    expect(await playerNames()).toContain('Bea Ryder');
    expect(await playerNames()).not.toContain('bea ryder');
    expect(await entrantNames()).toEqual(expect.arrayContaining(['Ann', 'Bea Ryder']));
  });

  /**
   * The catalogue half of a pasted list costs the same for six names as for
   * three: one query that asks which of them are already known, and one insert
   * for the rest. It used to be a query and an insert per name.
   */
  it('asks the catalogue once and inserts once, whatever the length of the list', async () => {
    const three = await statementsOf(() => request(app.getHttpServer())
      .post(`/players/divisions/${divisionId}/bulk`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ playerNames: ['Cal', 'Dee', 'Eve'] })
      .expect(201));

    const six = await statementsOf(() => request(app.getHttpServer())
      .post(`/players/divisions/${divisionId}/bulk`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ playerNames: ['Fay', 'Gus', 'Hal', 'Ivy', 'Jon', 'Kim'] })
      .expect(201));

    expect(touching(six, 'player').length).toBe(touching(three, 'player').length);
    expect(touching(six, 'player').filter((statement) => statement.startsWith('INSERT'))).toHaveLength(1);
  });

  it('registers somebody in the tournament before their division admits them', async () => {
    await request(app.getHttpServer())
      .post(`/players/divisions/${divisionId}/bulk`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ playerNames: ['Lena'] })
      .expect(201);
    const catalogue = await request(app.getHttpServer()).get('/players').expect(200);
    const playerId = catalogue.body
      .find((player: { playerName: string }) => player.playerName === 'Lena').id;

    const other = await request(app.getHttpServer())
      .post('/divisions')
      .send({ name: 'Second Division', tournamentId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/players/${playerId}/divisions/${other.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    const participants = await request(app.getHttpServer())
      .get(`/tournaments/${tournamentId}/participants`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(participants.body.filter((participant: { player: { id: number } }) => participant.player.id === playerId))
      .toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/players/${playerId}/divisions/${other.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    /* Withdrawing keeps the entrant and marks it, which is how a division
       remembers the seed somebody had if they come back. */
    const entrants = await request(app.getHttpServer()).get(`/divisions/${other.body.id}/entrants`).expect(200);
    expect(entrants.body).toEqual([expect.objectContaining({ name: 'Lena', status: 'withdrawn' })]);
  });
});
