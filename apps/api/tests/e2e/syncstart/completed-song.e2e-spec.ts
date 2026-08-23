import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { DataSource, Repository } from 'typeorm';

import { AppModule } from '../../../src/app.module';
import { Account } from '@tournament-manager/persistence';
import { LIVE_EVENT_PUBLISHER } from '@tournament-manager/live-messaging';
import type { EventEnvelope } from '@tournament-manager/live-messaging';
import { CompletedSongService } from '../../../src/tournament/syncstart/completed-song.service';
import { TournamentSyncStartService } from '../../../src/tournament/syncstart/tournament-syncstart.service';
import {
  dropTestDatabase,
  getTestDatabaseName,
  resetMigratedTestDatabase,
} from '../../support/postgres-test-database';

const database = getTestDatabaseName('completed_song');

process.env.DATABASE_NAME = database;

/**
 * What a lobby reports, once it reaches the database.
 *
 * The ingestion resolves who and what a completed song is about and then writes
 * through the match, which is the same call a person makes by choosing a run in
 * the standing dialog. What only a database shows is that the resolution finds
 * the right round, that the round is ranked when it fills up, that a run
 * nothing was waiting for is still recorded, and that the whole lobby costs one
 * write per match rather than one load of every active match per player.
 */
describe('Completed songs (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let ingestion: CompletedSongService;
  let accessToken: string;

  let tournamentId: number;
  let divisionId: number;
  let poolId: number;
  const entrantIdByName = new Map<string, number>();
  const playerIdByName = new Map<string, number>();
  const published: EventEnvelope[] = [];
  let completion = 0;

  const lobbyReport = (songTitle: string, scores: Array<{ playerName: string; exScore?: number; isFailed?: boolean }>) => ({
    completionId: `completion-${(completion += 1)}`,
    tournamentId,
    lobbyId: 'lobby-1',
    lobbyName: 'Lobby',
    lobbyCode: 'ABCD',
    song: { songPath: songTitle, title: songTitle, artist: 'Someone', songLength: 120 },
    scores: scores.map((score) => ({
      playerId: score.playerName,
      playerName: score.playerName,
      score: 900000,
      exScore: score.exScore,
      isFailed: score.isFailed ?? false,
    })),
  });

  async function addSong(title: string): Promise<number> {
    const song = await request(app.getHttpServer())
      .post('/songs')
      .send({ title, artist: 'Someone', group: 'Pack A', difficulty: 5, tournamentId })
      .expect(201);

    return song.body.id;
  }

  async function liveMatchOn(songId: number, names: string[]): Promise<number> {
    const match = await request(app.getHttpServer())
      .post('/matches')
      .send({
        name: 'Set',
        phaseGroupId: poolId,
        scoringSystem: 'PlacementPointsWithFailZero',
        entrantIds: names.map((name) => entrantIdByName.get(name)),
        songIds: [songId],
      })
      .expect(201);
    await request(app.getHttpServer()).put(`/matches/${match.body.id}/active`).send({ active: true }).expect(204);

    return match.body.id;
  }

  async function standingsOf(matchId: number) {
    const match = await request(app.getHttpServer()).get(`/matches/${matchId}`).expect(200);

    return match.body.rounds[0].standings;
  }

  async function report(payload: ReturnType<typeof lobbyReport>): Promise<EventEnvelope[]> {
    published.length = 0;
    await ingestion.submit(payload);

    return [...published];
  }

  /**
   * How many statements one completed song costs, with the match it lands in
   * set up first so that only the ingestion is counted.
   */
  async function statementsOf(
    arrange: () => Promise<{ matchId: number; report: ReturnType<typeof lobbyReport> }>,
  ): Promise<{ matchId: number; statements: number }> {
    const { matchId, report: payload } = await arrange();
    const logger = dataSource.logger;
    let statements = 0;
    (dataSource as unknown as { logger: unknown }).logger = { ...logger, logQuery: () => (statements += 1) };

    try {
      await report(payload);
    } finally {
      (dataSource as unknown as { logger: unknown }).logger = logger;
    }

    return { matchId, statements };
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
    ingestion = moduleFixture.get(CompletedSongService);
    const accountRepository = moduleFixture.get<Repository<Account>>(getRepositoryToken(Account));
    const credentials = {
      username: 'completed-song-owner',
      email: 'completed-song-owner@example.test',
      password: 'CompletedSongPassword!',
      playerName: 'Completed Song Owner',
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
      .send({ name: 'Completed Song Tournament' })
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

    const roster = await request(app.getHttpServer())
      .get(`/tournaments/${tournamentId}/participants`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    roster.body.forEach((participant: { player: { id: number; playerName: string } }) =>
      playerIdByName.set(participant.player.playerName, participant.player.id));

    await request(app.getHttpServer()).post('/phases').send({ name: 'Qualifiers', divisionId }).expect(201);
    const summary = await request(app.getHttpServer()).get(`/divisions/${divisionId}/summary`).expect(200);
    poolId = summary.body.phases[0].phaseGroups[0].id;
  });

  afterAll(async () => {
    await app.close();
    await dropTestDatabase(database);
  });

  it('scores the round both players were playing, and ranks it once it is full', async () => {
    const songId = await addSong('Anthem');
    const matchId = await liveMatchOn(songId, ['Ann', 'Bob']);

    const events = await report(lobbyReport('Anthem', [
      { playerName: 'Ann', exScore: 98.5 },
      { playerName: 'Bob', exScore: 91 },
    ]));

    const standings = await standingsOf(matchId);
    expect(standings.map((standing: { player: { playerName: string }; score: { percentage: number } }) => [
      standing.player.playerName,
      standing.score.percentage,
    ])).toEqual(expect.arrayContaining([['Ann', 98.5], ['Bob', 91]]));

    const points = new Map(standings.map((standing: { player: { playerName: string }; points: number }) =>
      [standing.player.playerName, standing.points]));
    expect(points.get('Ann')).toBeGreaterThan(points.get('Bob') as number);

    /* One match changed, and the pool changed with it: the match now has every
       standing it needs and is waiting to be committed, which the tree draws. */
    expect(events.map((event) => event.type)).toEqual(['ui.match-changed', 'ui.phase-group-changed']);
    expect(events[0].payload).toEqual({ tournamentId, divisionId, phaseId: expect.any(Number), phaseGroupId: poolId, matchId });
  });

  /**
   * The cost of a lobby is the lobby, not the tournament around it. The
   * previous ingestion loaded every active match of the tournament — with its
   * entrants, its rounds, its standings and the scores behind them — once for
   * every player in the lobby, so a busy tournament made every completed song
   * more expensive for everybody.
   */
  it('costs the same however many other matches are live in the tournament', async () => {
    const quiet = await statementsOf(async () => {
      const songId = await addSong('Second');
      const matchId = await liveMatchOn(songId, ['Ann', 'Bob']);

      return { matchId, report: lobbyReport('Second', [{ playerName: 'Ann', exScore: 80 }, { playerName: 'Bob', exScore: 70 }]) };
    });

    for (const title of ['Busy One', 'Busy Two', 'Busy Three', 'Busy Four']) {
      await liveMatchOn(await addSong(title), ['Ann']);
    }

    const busy = await statementsOf(async () => {
      const songId = await addSong('Third');
      const matchId = await liveMatchOn(songId, ['Ann', 'Bob']);

      return { matchId, report: lobbyReport('Third', [{ playerName: 'Ann', exScore: 60 }, { playerName: 'Bob', exScore: 50 }]) };
    });

    expect(busy.statements).toBe(quiet.statements);
    expect(await standingsOf(busy.matchId)).toHaveLength(2);
  });

  it('records a run no round was waiting for, and announces nothing', async () => {
    const songId = await addSong('Unwatched');

    const events = await report(lobbyReport('Unwatched', [{ playerName: 'Ann', exScore: 77 }]));

    const scores = await request(app.getHttpServer())
      .get('/scores')
      .query({ songId, playerId: playerIdByName.get('Ann') })
      .expect(200);
    expect(scores.body).toEqual([{ id: expect.any(Number), percentage: 77, isFailed: false }]);
    expect(events).toEqual([]);
  });

  it('warns about a run it cannot place, and saves nothing for it', async () => {
    await addSong('Warned');

    const missingScore = await report(lobbyReport('Warned', [{ playerName: 'Ann' }]));
    expect(missingScore.map((event) => event.type)).toEqual(['ui.warning']);
    expect(missingScore[0].payload).toEqual({ message: expect.stringContaining('No EX score found for Ann') });

    const unknownName = await report(lobbyReport('Warned', [{ playerName: 'Nobody', exScore: 50 }]));
    expect(unknownName.map((event) => event.type)).toEqual(['ui.warning']);
    expect(unknownName[0].payload).toEqual({ message: expect.stringContaining('No database player-song found for Nobody') });

    const unknownSong = await report(lobbyReport('Not in the pool', [{ playerName: 'Ann', exScore: 50 }]));
    expect(unknownSong.map((event) => event.type)).toEqual(['ui.warning']);
  });

  it('scores a completion once, however often SyncStart resends it', async () => {
    const songId = await addSong('Repeated');
    const matchId = await liveMatchOn(songId, ['Ann', 'Bob']);
    const payload = lobbyReport('Repeated', [{ playerName: 'Ann', exScore: 95 }]);

    await report(payload);
    const again = await report(payload);

    expect(again).toEqual([]);
    expect(await standingsOf(matchId)).toHaveLength(1);
  });
});
