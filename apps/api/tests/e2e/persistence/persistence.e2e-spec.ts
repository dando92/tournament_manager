import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  Entrant,
  Match,
  MatchResult,
  Participant,
  Player,
  Round,
  Score,
  Song,
  Standing,
  PhaseGroup,
} from '@tournament-manager/persistence';
import { MatchStore } from '@match/match.store';
import { ScoreService } from '@tournament/competition/services/score.service';
import {
  dropTestDatabase,
  getTestDatabaseName,
  getTestDataSourceOptions,
  resetMigratedTestDatabase,
} from '../../support/postgres-test-database';

describe('Score and match-result persistence (e2e)', () => {
  const database = getTestDatabaseName('persistence');
  let app: INestApplication;
  let scoreService: ScoreService;
  let matchStore: MatchStore;
  let playerRepository: Repository<Player>;
  let songRepository: Repository<Song>;
  let scoreRepository: Repository<Score>;
  let matchRepository: Repository<Match>;
  let matchResultRepository: Repository<MatchResult>;
  let participantRepository: Repository<Participant>;
  let entrantRepository: Repository<Entrant>;

  beforeAll(async () => {
    const migrations = await resetMigratedTestDatabase(database);
    await migrations.destroy();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(getTestDataSourceOptions(database)),
        TypeOrmModule.forFeature([
          Player,
          Song,
          Score,
          Match,
          MatchResult,
          Round,
          Standing,
          Entrant,
          Participant,
          PhaseGroup,
        ]),
      ],
      providers: [ScoreService, MatchStore],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    scoreService = moduleFixture.get(ScoreService);
    matchStore = moduleFixture.get(MatchStore);
    playerRepository = moduleFixture.get(getRepositoryToken(Player));
    songRepository = moduleFixture.get(getRepositoryToken(Song));
    scoreRepository = moduleFixture.get(getRepositoryToken(Score));
    matchRepository = moduleFixture.get(getRepositoryToken(Match));
    matchResultRepository = moduleFixture.get(getRepositoryToken(MatchResult));
    participantRepository = moduleFixture.get(getRepositoryToken(Participant));
    entrantRepository = moduleFixture.get(getRepositoryToken(Entrant));
  });

  afterAll(async () => {
    await app.close();
    await dropTestDatabase(database);
  });

  it('creates, loads, filters, and updates a score with its relations', async () => {
    const player = await playerRepository.save(
      playerRepository.create({ playerName: 'Persistence Player' }),
    );
    const song = await songRepository.save(
      songRepository.create({
        title: 'Persistence Song',
        artist: 'Test Artist',
        group: 'Test Group',
        difficulty: 10,
      }),
    );

    const created = await scoreService.create({
      playerId: player.id,
      songId: song.id,
      percentage: 98.5,
      isFailed: false,
    });

    await expect(scoreService.findOne(created.id)).resolves.toMatchObject({
      id: created.id,
      percentage: 98.5,
      isFailed: false,
      player: { id: player.id },
      song: { id: song.id },
    });
    await expect(
      scoreService.find({ playerId: player.id, songId: song.id }),
    ).resolves.toHaveLength(1);

    await scoreService.update(created.id, { percentage: 75, isFailed: true });
    await expect(
      scoreRepository.findOneByOrFail({ id: created.id }),
    ).resolves.toMatchObject({
      percentage: 75,
      isFailed: true,
    });
  });

  it('rejects a score whose player or song does not exist', async () => {
    await expect(
      scoreService.create({
        playerId: 999999,
        songId: 999999,
        percentage: 90,
        isFailed: false,
      }),
    ).rejects.toThrow('Song with ID 999999 not found');
  });

  /**
   * One save writes the whole aggregate: the round it grew, the standing inside
   * that round, and the result the commit produced. Reopening it takes the
   * result row away rather than leaving it unreferenced.
   */
  it('writes a match, its rounds and its result through one store', async () => {
    const player = await playerRepository.save(playerRepository.create({ playerName: 'Aggregate Player' }));
    const participant = await participantRepository.save(
      participantRepository.create({ player, roles: [], status: 'registered' }),
    );
    const entrant = await entrantRepository.save(
      entrantRepository.create({ name: 'Aggregate Entrant', type: 'player', participants: [participant] }),
    );
    const stored = await matchRepository.save(
      matchRepository.create({
        name: 'Aggregate Match',
        scoringSystem: 'EurocupScoreCalculator',
        active: true,
        entrants: [entrant],
      }),
    );

    const match = await matchStore.loadOrFail(stored.id);
    match.addRound(null);
    await matchStore.save(match);

    const withRound = await matchStore.loadOrFail(stored.id);
    const roundId = withRound.rounds[0].id;
    withRound.upsertPoints(roundId, player, 3);
    withRound.commit();
    await matchStore.save(withRound);

    const committed = await matchStore.loadOrFail(stored.id);
    expect(committed.entity.active).toBe(false);
    expect(committed.entity.matchResult.playerPoints).toEqual([{ playerId: player.id, points: 3 }]);
    expect(committed.rounds[0].standings[0].points).toBe(3);
    await expect(matchResultRepository.count()).resolves.toBe(1);

    committed.reopen();
    await matchStore.save(committed);

    await expect(matchResultRepository.count()).resolves.toBe(0);
    await expect(matchStore.loadOrFail(stored.id)).resolves.toMatchObject({ isCompleted: false });

    const reopened = await matchStore.loadOrFail(stored.id);
    reopened.removeStanding(roundId, player.id);
    reopened.removeRound(roundId);
    await matchStore.save(reopened);

    await expect(matchStore.loadOrFail(stored.id)).resolves.toMatchObject({ rounds: [] });
  });

});
