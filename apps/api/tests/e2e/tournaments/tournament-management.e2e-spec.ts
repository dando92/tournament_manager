import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { Repository } from 'typeorm';

import { AppModule } from '../../../src/app.module';
import { Account } from '@tournament-manager/persistence';
import { TournamentSyncStartService } from '../../../src/tournament/syncstart/tournament-syncstart.service';
import * as fixture from './fixtures/tournament-management.json';
import {
  dropTestDatabase,
  getTestDatabaseName,
  resetMigratedTestDatabase,
} from '../../support/postgres-test-database';

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
    })
      .overrideProvider(TournamentSyncStartService)
      .useValue({
        configureTournament: jest.fn().mockResolvedValue(undefined),
        closeTournament: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
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
    // FQ-003: creation accepts only the name; configuration keeps its persisted defaults.
    expect(createResponse.body).toMatchObject({
      name: fixture.createTournament.name,
      availableSetupsCount: 2,
      defaultScoringSystem: 'EurocupScoreCalculator',
    });
    expect(createResponse.body.syncstartUrl).toBe('ws://syncservice.groovestats.com:1337');

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
          syncstartUrl: fixture.updateTournament.syncstartUrl,
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

    /* Pool membership is derived: an entrant is in a pool because a match there
       holds it. The routes that put one in by hand were removed in e9c02ed
       precisely because they fought that derivation, so the way to seed a pool
       is to give it a match. */
    await request(app.getHttpServer())
      .post('/matches')
      .send({
        name: 'Qualifier 1',
        phaseGroupId,
        scoringSystem: 'EurocupScoreCalculator',
        entrantIds: [entrantId],
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/phase-groups/${phaseGroupId}/entrants`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toContainEqual(
          expect.objectContaining({ entrant: expect.objectContaining({ id: entrantId }) }),
        );
      });

    await request(app.getHttpServer())
      .get(`/tournaments/${tournamentId}/overview`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          divisionCount: 1,
          playerCount: 1,
          matchCount: 1,
        });
        expect(body.divisions[0].phases[0].phaseGroups[0]).toMatchObject({
          matchCount: 1,
          pendingMatchCount: 0,
        });
      });
  });

  it('reads a tournament record, its configuration, its key status and the roles of the account that owns it', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/tournaments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Read Model Tournament' })
      .expect(201);
    const tournamentId = createResponse.body.id;

    /* The record carries no staff list. Every response declared one, it was
       always empty because the load never reached the participants, and no
       client read it. */
    await request(app.getHttpServer())
      .get(`/tournaments/${tournamentId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          id: tournamentId,
          name: 'Read Model Tournament',
          status: 'open',
          closedAt: null,
          syncstartUrl: 'ws://syncservice.groovestats.com:1337',
          availableSetupsCount: 2,
          defaultScoringSystem: 'EurocupScoreCalculator',
        });
      });

    await request(app.getHttpServer())
      .get(`/tournaments/${tournamentId}/configuration`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: tournamentId,
          name: 'Read Model Tournament',
          status: 'open',
          closedAt: null,
          startggApiKey: null,
        });
        expect(typeof body.transportRetentionDays).toBe('number');
      });

    await request(app.getHttpServer())
      .get(`/tournaments/${tournamentId}/startgg/api-key-status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => expect(body).toEqual({ hasStartggApiKey: false }));

    await request(app.getHttpServer())
      .patch(`/tournaments/${tournamentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ startggApiKey: 'a-key' })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/tournaments/${tournamentId}/startgg/api-key-status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => expect(body).toEqual({ hasStartggApiKey: true }));

    /* Creating a tournament makes the creator its owner, and the participant
       that records it carries the account. A role is an element of the stored
       list, not a substring of it, so `owner` does not make the account staff. */
    await request(app.getHttpServer())
      .get('/tournaments/my-roles')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.ownedTournamentIds).toContain(tournamentId);
        expect(body.staffTournamentIds).not.toContain(tournamentId);
        expect(body).toMatchObject({ isAdmin: false, canCreateTournament: true });
      });

    /* An unknown tournament is refused rather than reported missing: the access
       guard runs before the handler and finds no participation to authorize. */
    await request(app.getHttpServer())
      .get('/tournaments/999999/configuration')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('lists the participants of a tournament and previews what importing a list of names would do', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/tournaments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Registration Tournament' })
      .expect(201);
    const tournamentId = createResponse.body.id;

    for (const playerName of ['Zeta Player', 'alpha player']) {
      await request(app.getHttpServer())
        .post(`/tournaments/${tournamentId}/participants`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ playerName })
        .expect(201);
    }

    /* Creating the tournament made its creator a participant too, so the list
       holds three. It is ordered by the name each competes under, ignoring
       case: an ASCII order would put both capitalized names first. */
    await request(app.getHttpServer())
      .get(`/tournaments/${tournamentId}/participants`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((participant) => participant.player.playerName)).toEqual([
          'alpha player',
          fixture.account.playerName,
          'Zeta Player',
        ]);
        expect(body[0]).toEqual({
          id: expect.any(Number),
          roles: ['competitor'],
          status: 'registered',
          player: { id: expect.any(Number), playerName: 'alpha player' },
        });
      });

    /* Names are distinct by their trimmed form and keep the order they were
       sent in; matching a player against them ignores case as well. */
    await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/participants/import-preview`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ playerNames: ['  alpha player  ', 'ALPHA PLAYER', 'Brand New Player', '   '] })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual([
          {
            name: 'alpha player',
            matchedPlayer: { id: expect.any(Number), playerName: 'alpha player' },
            alreadyParticipant: true,
          },
          {
            name: 'ALPHA PLAYER',
            matchedPlayer: { id: expect.any(Number), playerName: 'alpha player' },
            alreadyParticipant: true,
          },
          {
            name: 'Brand New Player',
            matchedPlayer: null,
            alreadyParticipant: false,
          },
        ]);
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
