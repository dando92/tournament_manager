import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WsAdapter } from '@nestjs/platform-ws';
import * as request from 'supertest';
import { Repository } from 'typeorm';

import { AppModule } from '../src/app.module';
import { Account } from '@persistence/entities';
import * as fixture from './fixtures/tournament-management.json';
import {
  dropTestDatabase,
  getTestDatabaseName,
  resetMigratedTestDatabase,
} from './support/postgres-test-database';

describe('Tournament management (e2e)', () => {
  const database = getTestDatabaseName('application');
  let app: INestApplication;
  let accountRepository: Repository<Account>;
  let accessToken: string;

  beforeAll(async () => {
    const migrations = await resetMigratedTestDatabase(database);
    await migrations.destroy();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.init();
    accountRepository = moduleFixture.get<Repository<Account>>(
      getRepositoryToken(Account),
    );

    await request(app.getHttpServer())
      .post('/user')
      .send(fixture.account)
      .expect(201);

    const account = await accountRepository.findOneByOrFail({
      username: fixture.account.username,
    });
    account.isTournamentCreator = true;
    await accountRepository.save(account);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: fixture.account.username,
        password: fixture.account.password,
      })
      .expect(201);

    accessToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
    await dropTestDatabase(database);
  });

  it('rejects tournament creation without authentication', async () => {
    await request(app.getHttpServer())
      .post('/tournaments')
      .send(fixture.createTournament)
      .expect(401);
  });

  it('creates, reads, updates, and publicly lists a tournament', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/tournaments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(fixture.createTournament)
      .expect(201);

    const tournamentId = createResponse.body.id;
    expect(createResponse.body).toMatchObject({
      name: fixture.createTournament.name,
      syncstartUrl: fixture.createTournament.syncstartUrl,
    });

    await request(app.getHttpServer())
      .get(`/tournaments/${tournamentId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: tournamentId,
          name: fixture.createTournament.name,
        });
      });

    await request(app.getHttpServer())
      .patch(`/tournaments/${tournamentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(fixture.updateTournament)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: tournamentId,
          name: fixture.updateTournament.name,
        });
      });

    await request(app.getHttpServer())
      .get('/tournaments/public')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toContainEqual({
          id: tournamentId,
          name: fixture.updateTournament.name,
        });
      });
  });

  it('creates participants and the tournament division structure', async () => {
    const tournamentResponse = await request(app.getHttpServer())
      .post('/tournaments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Structure Baseline Tournament' })
      .expect(201);
    const tournamentId = tournamentResponse.body.id;

    const participantResponse = await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/participants`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ playerName: 'Structure Player' })
      .expect(201);
    const participantId = participantResponse.body.id;

    const divisionResponse = await request(app.getHttpServer())
      .post('/divisions')
      .send({ name: 'Main Division', tournamentId })
      .expect(201);
    const divisionId = divisionResponse.body.id;

    const entrantResponse = await request(app.getHttpServer())
      .post(`/divisions/${divisionId}/participants/${participantId}`)
      .expect(201);
    const entrantId = entrantResponse.body.id;

    const phaseResponse = await request(app.getHttpServer())
      .post('/phases')
      .send({ name: 'Qualifiers', divisionId })
      .expect(201);
    const phaseId = phaseResponse.body.id;

    const phaseGroupResponse = await request(app.getHttpServer())
      .post(`/phases/${phaseId}/phase-groups`)
      .send({ name: 'Pool A', displayIdentifier: 'A' })
      .expect(201);
    const phaseGroupId = phaseGroupResponse.body.id;

    await request(app.getHttpServer())
      .post(`/phase-groups/${phaseGroupId}/entrants/${entrantId}`)
      .expect(201);

    await request(app.getHttpServer())
      .get(`/phase-groups/${phaseGroupId}/entrants`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toContainEqual(expect.objectContaining({ id: entrantId }));
      });

    await request(app.getHttpServer())
      .get(`/tournaments/${tournamentId}/overview`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          divisionCount: 1,
          playerCount: 1,
          matchCount: 0,
        });
      });
  });

  it('makes a closed tournament read-only until an authorized user reopens it', async () => {
    const tournamentResponse = await request(app.getHttpServer())
      .post('/tournaments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Lifecycle Tournament' })
      .expect(201);
    const tournamentId = tournamentResponse.body.id;

    await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/close`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe('closed');
        expect(body.closedAt).toBeTruthy();
      });

    await request(app.getHttpServer())
      .patch(`/tournaments/${tournamentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Forbidden update' })
      .expect(409);

    await request(app.getHttpServer())
      .post('/divisions')
      .send({ name: 'Forbidden division', tournamentId })
      .expect(409);

    await request(app.getHttpServer())
      .get(`/tournaments/${tournamentId}`)
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('closed'));

    await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/reopen`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe('open');
        expect(body.closedAt).toBeNull();
      });

    await request(app.getHttpServer())
      .post('/divisions')
      .send({ name: 'Allowed division', tournamentId })
      .expect(201);
  });
});
