import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { Repository } from 'typeorm';

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

const database = getTestDatabaseName('song_writes');

process.env.DATABASE_NAME = database;

/**
 * The song catalogue as it is written, and what a roll makes of it.
 *
 * A song is not an aggregate: adding one to a pool and taking it out are the
 * whole of it, and neither announces anything. What is worth a database here is
 * the read behind a roll — which division has already played what — and the
 * scope a roll now takes from the match it is rolled for rather than from the
 * caller.
 */
describe('Song writes (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  let tournamentId: number;
  let divisionId: number;
  let poolId: number;
  let entrantId: number;
  const published: EventEnvelope[] = [];

  async function addSong(title: string, group: string, difficulty: number, target?: number): Promise<number> {
    const created = await request(app.getHttpServer())
      .post('/songs')
      .send({ title, artist: 'Someone', group, difficulty, tournamentId: target ?? tournamentId })
      .expect(201);

    return created.body.id;
  }

  async function createMatch(): Promise<number> {
    const match = await request(app.getHttpServer())
      .post('/matches')
      .send({ name: 'Set', phaseGroupId: poolId, scoringSystem: 'EurocupScoreCalculator', entrantIds: [entrantId] })
      .expect(201);

    return match.body.id;
  }

  /** The songs a match ended up being played on, in the order its rounds hold them. */
  async function songsOf(matchId: number): Promise<Array<number | null>> {
    const match = await request(app.getHttpServer()).get(`/matches/${matchId}`).expect(200);

    return match.body.rounds.map((round: { song: { id: number } | null }) => round.song?.id ?? null);
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

    const accountRepository = moduleFixture.get<Repository<Account>>(getRepositoryToken(Account));
    const credentials = {
      username: 'song-writes-owner',
      email: 'song-writes-owner@example.test',
      password: 'SongWritesPassword!',
      playerName: 'Song Writes Owner',
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
      .send({ name: 'Song Writes Tournament' })
      .expect(201);
    tournamentId = tournament.body.id;

    const division = await request(app.getHttpServer())
      .post('/divisions')
      .send({ name: 'Main Division', tournamentId })
      .expect(201);
    divisionId = division.body.id;

    const participant = await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/participants`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ playerName: 'Ann' })
      .expect(201);
    const entrant = await request(app.getHttpServer())
      .post(`/divisions/${divisionId}/participants/${participant.body.id}`)
      .expect(201);
    entrantId = entrant.body.id;

    await request(app.getHttpServer()).post('/phases').send({ name: 'Qualifiers', divisionId }).expect(201);
    const summary = await request(app.getHttpServer()).get(`/divisions/${divisionId}/summary`).expect(200);
    poolId = summary.body.phases[0].phaseGroups[0].id;
  });

  afterAll(async () => {
    await app.close();
    await dropTestDatabase(database);
  });

  it('adds a song to the pool of one tournament, and announces nothing', async () => {
    published.length = 0;
    const songId = await addSong('Anthem', 'Pack A', 5);

    const pool = await request(app.getHttpServer()).get('/songs').query({ tournamentId }).expect(200);
    expect(pool.body).toContainEqual({ id: songId, title: 'Anthem', artist: 'Someone', difficulty: 5, group: 'Pack A' });
    expect(published).toEqual([]);
  });

  it('refuses a song for a tournament that does not exist', async () => {
    await request(app.getHttpServer())
      .post('/songs')
      .send({ title: 'Nowhere', group: 'Pack A', difficulty: 5, tournamentId: 999999 })
      .expect(404);
  });

  it('takes a song out of the pool', async () => {
    const songId = await addSong('Leaving', 'Pack A', 6);

    await request(app.getHttpServer()).delete(`/songs/${songId}`).expect(204);

    const pool = await request(app.getHttpServer()).get('/songs').query({ tournamentId }).expect(200);
    expect(pool.body.map((song: { id: number }) => song.id)).not.toContain(songId);
  });

  /**
   * The roll instructions used to be the caller's. The one client there is
   * sends the division and never the tournament, and the roller answers with
   * nothing unless it has both — so a rolled round silently added no song at
   * all. The match knows which division it is played in, so it is not asked.
   */
  it('rolls a song of the level asked for, from the pool of the division the match is in', async () => {
    const songId = await addSong('Rolled', 'Roll Pack', 11);
    const matchId = await createMatch();

    await request(app.getHttpServer())
      .post(`/matches/${matchId}/rounds`)
      .send({ group: 'Roll Pack', level: '11' })
      .expect(204);

    expect(await songsOf(matchId)).toEqual([songId]);
  });

  it('does not roll a song the division has already played', async () => {
    const first = await addSong('Once', 'Second Pack', 12);
    const played = await createMatch();
    await request(app.getHttpServer())
      .post(`/matches/${played}/rounds`)
      .send({ group: 'Second Pack', level: '12' })
      .expect(204);
    expect(await songsOf(played)).toEqual([first]);

    const second = await addSong('Twice', 'Second Pack', 12);
    const next = await createMatch();
    await request(app.getHttpServer())
      .post(`/matches/${next}/rounds`)
      .send({ group: 'Second Pack', level: '12' })
      .expect(204);

    expect(await songsOf(next)).toEqual([second]);
  });

  it('adds no round at all when nothing of that level is left to play', async () => {
    const matchId = await createMatch();

    await request(app.getHttpServer())
      .post(`/matches/${matchId}/rounds`)
      .send({ group: 'Roll Pack', level: '19' })
      .expect(204);

    expect(await songsOf(matchId)).toEqual([]);
  });

  it('does not roll the pool of another tournament', async () => {
    const other = await request(app.getHttpServer())
      .post('/tournaments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Other Tournament' })
      .expect(201);
    await addSong('Elsewhere', 'Foreign Pack', 13, other.body.id);

    const matchId = await createMatch();
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/rounds`)
      .send({ group: 'Foreign Pack', level: '13' })
      .expect(204);

    expect(await songsOf(matchId)).toEqual([]);
  });
});
