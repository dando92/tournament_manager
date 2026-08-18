import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WsAdapter } from '@nestjs/platform-ws';
import * as request from 'supertest';
import { Repository } from 'typeorm';

import { AppModule } from '../src/app.module';
import { Account } from '@persistence/entities';
import * as fixture from './fixtures/tournament-management.json';

describe('Tournament management (e2e)', () => {
  let app: INestApplication;
  let accountRepository: Repository<Account>;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.init();
    accountRepository = moduleFixture.get<Repository<Account>>(getRepositoryToken(Account));

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
});
