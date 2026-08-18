import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Match, MatchResult, Player, Score, Song } from '@persistence/entities';
import { MatchResultService } from '@match/services/match-result.service';
import { ScoreService } from '@tournament/services/score.service';
import {
  dropTestDatabase,
  getTestDatabaseName,
  getTestDataSourceOptions,
  resetMigratedTestDatabase,
} from './support/postgres-test-database';

describe('Score and match-result persistence (e2e)', () => {
  const database = getTestDatabaseName('persistence');
  let app: INestApplication;
  let scoreService: ScoreService;
  let matchResultService: MatchResultService;
  let playerRepository: Repository<Player>;
  let songRepository: Repository<Song>;
  let scoreRepository: Repository<Score>;
  let matchRepository: Repository<Match>;
  let matchResultRepository: Repository<MatchResult>;

  beforeAll(async () => {
    const migrations = await resetMigratedTestDatabase(database);
    await migrations.destroy();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(getTestDataSourceOptions(database)),
        TypeOrmModule.forFeature([Player, Song, Score, Match, MatchResult]),
      ],
      providers: [ScoreService, MatchResultService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    scoreService = moduleFixture.get(ScoreService);
    matchResultService = moduleFixture.get(MatchResultService);
    playerRepository = moduleFixture.get(getRepositoryToken(Player));
    songRepository = moduleFixture.get(getRepositoryToken(Song));
    scoreRepository = moduleFixture.get(getRepositoryToken(Score));
    matchRepository = moduleFixture.get(getRepositoryToken(Match));
    matchResultRepository = moduleFixture.get(getRepositoryToken(MatchResult));
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

  it('creates, replaces, and deletes the result associated with a match', async () => {
    const match = await matchRepository.save(
      matchRepository.create({
        name: 'Persistence Match',
        scoringSystem: 'EurocupScoreCalculator',
        active: false,
      }),
    );

    const created = await matchResultService.upsertForMatch(match.id, [
      { playerId: 1, points: 2 },
      { playerId: 2, points: 1 },
    ]);
    const updated = await matchResultService.upsertForMatch(match.id, [
      { playerId: 2, points: 3 },
      { playerId: 1, points: 0 },
    ]);

    expect(updated.id).toBe(created.id);
    expect(updated.playerPoints).toEqual([
      { playerId: 2, points: 3 },
      { playerId: 1, points: 0 },
    ]);
    await expect(matchResultRepository.count()).resolves.toBe(1);

    await matchResultService.deleteForMatch(match.id);

    await expect(matchResultRepository.count()).resolves.toBe(0);
    await expect(
      matchRepository.findOne({
        where: { id: match.id },
        relations: { matchResult: true },
      }),
    ).resolves.toMatchObject({ matchResult: null });
  });
});
