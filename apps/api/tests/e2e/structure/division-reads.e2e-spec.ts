import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { Repository } from 'typeorm';

import { AppModule } from '../../../src/app.module';
import { Account } from '@tournament-manager/persistence';
import { TournamentSyncStartService } from '../../../src/tournament/syncstart/tournament-syncstart.service';
import {
  dropTestDatabase,
  getTestDatabaseName,
  resetMigratedTestDatabase,
} from '../../support/postgres-test-database';

const database = getTestDatabaseName('division_reads');

/* The application reads its database from the environment, and `setup-env.ts`
   restores that name for every spec file, so claiming one here isolates this
   suite without reaching into another. */
process.env.DATABASE_NAME = database;

/**
 * The three division read routes, against a real PostgreSQL.
 *
 * `DivisionQueries` and `StandingsQueries` project with raw SQL, which the
 * compiler does not check. The scenario carries what the projections branch on:
 * seeded and unseeded entrants, a participant in the tournament who competes in
 * no division, a round played on a song and a hand-scored round without one.
 */
describe('Division reads (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  let tournamentId: number;
  let divisionId: number;
  let poolId: number;

  const entrantIdByName = new Map<string, number>();
  const participantIdByName = new Map<string, number>();
  const playerIdByName = new Map<string, number>();

  const ownerCredentials = {
    username: 'division-reads-owner',
    email: 'division-reads-owner@example.test',
    password: 'DivisionReadsPassword!',
    playerName: 'Division Reads Owner',
  };

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

    const accountRepository = moduleFixture.get<Repository<Account>>(getRepositoryToken(Account));
    await request(app.getHttpServer()).post('/user').send(ownerCredentials).expect(201);
    const account = await accountRepository.findOneByOrFail({ username: ownerCredentials.username });
    account.isTournamentCreator = true;
    await accountRepository.save(account);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: ownerCredentials.username, password: ownerCredentials.password })
      .expect(201);
    accessToken = login.body.access_token;

    const tournament = await request(app.getHttpServer())
      .post('/tournaments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Division Reads Tournament' })
      .expect(201);
    tournamentId = tournament.body.id;

    const division = await request(app.getHttpServer())
      .post('/divisions')
      .send({ name: 'Main Division', tournamentId })
      .expect(201);
    divisionId = division.body.id;

    for (const playerName of ['Cal Player', 'ann player', 'Bob Player', 'Dee Player']) {
      await addParticipant(playerName);
    }
    /* Dee competes in no division, so only the available-participants read may
       see them. */
    for (const playerName of ['Cal Player', 'ann player', 'Bob Player']) {
      await addEntrant(playerName);
    }

    const phase = await request(app.getHttpServer())
      .post('/phases')
      .send({ name: 'Qualifiers', divisionId })
      .expect(201);

    const pool = await request(app.getHttpServer())
      .post(`/phases/${phase.body.id}/phase-groups`)
      .send({ name: 'Pool A', displayIdentifier: 'A' })
      .expect(201);
    poolId = pool.body.id;
  });

  afterAll(async () => {
    await app.close();
    await dropTestDatabase(database);
  });

  async function addParticipant(playerName: string): Promise<void> {
    const participant = await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/participants`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ playerName })
      .expect(201);

    participantIdByName.set(playerName, participant.body.id);
    playerIdByName.set(playerName, participant.body.player.id);
  }

  async function addEntrant(playerName: string): Promise<void> {
    const entrant = await request(app.getHttpServer())
      .post(`/divisions/${divisionId}/participants/${participantIdByName.get(playerName)}`)
      .expect(201);

    entrantIdByName.set(playerName, entrant.body.id);
  }

  it('lists the roster by seed, with the unseeded entrants last', async () => {
    await request(app.getHttpServer())
      .patch(`/divisions/${divisionId}/entrants/seeding`)
      .send({ entrantIds: [entrantIdByName.get('Bob Player'), entrantIdByName.get('Cal Player')] })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/divisions/${divisionId}/entrants`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((entrant) => entrant.name)).toEqual(['Bob Player', 'Cal Player', 'ann player']);
        expect(body[0]).toEqual({
          id: entrantIdByName.get('Bob Player'),
          name: 'Bob Player',
          type: 'player',
          status: 'active',
          participants: [
            {
              id: participantIdByName.get('Bob Player'),
              roles: ['competitor'],
              status: 'registered',
              player: { id: playerIdByName.get('Bob Player'), playerName: 'Bob Player' },
            },
          ],
        });
      });
  });

  it('offers the participants of the tournament who compete in no entrant of the division', async () => {
    await request(app.getHttpServer())
      .get(`/divisions/${divisionId}/available-participants`)
      .expect(200)
      .expect(({ body }) => {
        /* The account that created the tournament is a participant of it and
           competes in nothing, so it is offered alongside Dee. The order
           ignores case. */
        expect(body.map((participant) => participant.player.playerName)).toEqual([
          'Dee Player',
          ownerCredentials.playerName,
        ]);
        expect(body[0]).toEqual({
          id: participantIdByName.get('Dee Player'),
          roles: ['competitor'],
          status: 'registered',
          player: { id: playerIdByName.get('Dee Player'), playerName: 'Dee Player' },
        });
      });
  });

  it('totals the points of a division and counts only the rounds played on a song', async () => {
    const song = await request(app.getHttpServer())
      .post('/songs')
      .send({ title: 'Standings', artist: 'Aggregate', group: 'Test', difficulty: 9, tournamentId })
      .expect(201);

    const match = await request(app.getHttpServer())
      .post('/matches')
      .send({
        name: 'Qualifier 1',
        phaseGroupId: poolId,
        scoringSystem: 'EurocupScoreCalculator',
        entrantIds: [entrantIdByName.get('Bob Player'), entrantIdByName.get('Cal Player')],
        songIds: [song.body.id],
      })
      .expect(201);

    const playedRoundId = match.body.rounds[0].id;
    await request(app.getHttpServer())
      .put(`/rounds/${playedRoundId}/scores/${playerIdByName.get('Bob Player')}`)
      .send({ percentage: 95, isFailed: false })
      .expect(200);
    await request(app.getHttpServer())
      .put(`/rounds/${playedRoundId}/scores/${playerIdByName.get('Cal Player')}`)
      .send({ percentage: 80, isFailed: false })
      .expect(200);

    /* A round with no song is hand-scored: it awards points without anything
       having been played. A match may not mix the two, so the hand-scored round
       belongs to a second match, and the division totals span both. */
    const handScoredMatch = await request(app.getHttpServer())
      .post('/matches')
      .send({
        name: 'Qualifier 2',
        phaseGroupId: poolId,
        scoringSystem: 'EurocupScoreCalculator',
        entrantIds: [entrantIdByName.get('Cal Player')],
      })
      .expect(201);

    const withHandScoredRound = await request(app.getHttpServer())
      .post(`/matches/${handScoredMatch.body.id}/rounds`)
      .send({})
      .expect(201);
    const handScoredRoundId = withHandScoredRound.body.rounds[0].id;
    await request(app.getHttpServer())
      .put(`/rounds/${handScoredRoundId}/points/${playerIdByName.get('Cal Player')}`)
      .send({ points: 5 })
      .expect(200);

    const scored = await request(app.getHttpServer()).get(`/matches/${match.body.id}`).expect(200);
    const pointsOf = (roundIndex: number, playerName: string): number =>
      scored.body.rounds[roundIndex].standings.find(
        (standing) => standing.player.id === playerIdByName.get(playerName),
      ).points;

    const expected = [
      {
        id: playerIdByName.get('Bob Player'),
        playerName: 'Bob Player',
        points: pointsOf(0, 'Bob Player'),
        songsPlayed: 1,
      },
      {
        id: playerIdByName.get('Cal Player'),
        playerName: 'Cal Player',
        points: pointsOf(0, 'Cal Player') + 5,
        songsPlayed: 1,
      },
    ].sort((left, right) => right.points - left.points);

    await request(app.getHttpServer())
      .get(`/divisions/${divisionId}/standings`)
      .expect(200)
      .expect(({ body }) => expect(body).toEqual(expected));
  });

  it('summarizes the division as one node of the tree, with the pending count and rules of each pool', async () => {
    /* Creating the phase gave it a default pool, so the phase holds two. The
       one this suite named carries both matches. */
    const rules = [{ sourcePlacement: 1, targetKind: 'phase_group', targetId: poolId, targetSlot: 1 }];
    await request(app.getHttpServer())
      .put(`/advancement-rules/sources/phase_group/${poolId}`)
      .send({ rules })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/divisions/${divisionId}/summary`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: divisionId,
          name: 'Main Division',
          entrantCount: 3,
          matchCount: 2,
        });
        expect(body.phases).toHaveLength(1);
        expect(body.phases[0].matchCount).toBe(2);

        const pool = body.phases[0].phaseGroups.find((candidate) => candidate.id === poolId);
        /* Both matches have every score in and neither has a committed result,
           so both are waiting on a person. */
        expect(pool).toMatchObject({
          name: 'Pool A',
          displayIdentifier: 'A',
          state: 'pending',
          matchCount: 2,
          pendingMatchCount: 2,
        });
        expect(pool.advancementRules).toEqual([
          {
            id: expect.any(Number),
            sourceKind: 'phase_group',
            sourceId: poolId,
            sourcePlacement: 1,
            targetKind: 'phase_group',
            targetId: poolId,
            targetSlot: 1,
          },
        ]);
        /* A pool states how many matches it holds and never the matches
           themselves, and it no longer states an entrant list that was always
           empty. */
        expect(Object.keys(pool).sort()).toEqual([
          'advancementRules',
          'bracketType',
          'displayIdentifier',
          'id',
          'matchCount',
          'name',
          'pendingMatchCount',
          'state',
        ]);
      });
  });

  it('answers a pool mutation with the node the tree draws', async () => {
    await request(app.getHttpServer())
      .patch(`/phase-groups/${poolId}`)
      .send({ name: 'Pool A renamed' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: poolId,
          name: 'Pool A renamed',
          matchCount: 2,
          pendingMatchCount: 2,
        });
        expect(body.advancementRules).toHaveLength(1);
      });
  });

  it('answers 404 for a division that does not exist', async () => {
    for (const route of ['entrants', 'available-participants', 'standings']) {
      await request(app.getHttpServer()).get(`/divisions/999999/${route}`).expect(404);
    }
    await request(app.getHttpServer()).get('/divisions/999999/summary').expect(404);
  });
});
