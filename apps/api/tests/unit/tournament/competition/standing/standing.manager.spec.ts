import { BadRequestException } from '@nestjs/common';
import { Match, Player, Round, Score, Standing } from '@tournament-manager/persistence';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';
import { MatchService } from '@match/services/match.service';
import { MatchWorkflowManager } from '@match/services/match-workflow.manager';

import { RoundService } from '@tournament/competition/services/round.service';
import { ScoreService } from '@tournament/competition/services/score.service';
import { ScoringSystemProvider } from '@tournament-manager/scoring';
import { StandingManager } from '@tournament/competition/standing/standing.manager';
import { StandingService } from '@tournament/competition/standing/standing.service';

const PLAYED_ROUND_ID = 30;
const HAND_SCORED_ROUND_ID = 31;

function player(id: number): Player {
  return { id, playerName: `Player ${id}` } as Player;
}

function score(id: number, scorePlayer: Player, percentage: number): Score {
  return {
    id,
    player: scorePlayer,
    song: { id: 10, title: 'Test Song' },
    percentage,
    isFailed: false,
  } as Score;
}

function standing(id: number, standingPlayer: Player, standingScore?: Score, points = 0): Standing {
  return { id, player: standingPlayer, score: standingScore ?? null, points } as Standing;
}

function match(players: Player[], rounds: Partial<Round>[]): Match {
  return {
    id: 20,
    scoringSystem: 'EurocupScoreCalculator',
    entrants: players.map((entrantPlayer, index) => ({
      id: index + 1,
      type: 'player',
      participants: [{ player: entrantPlayer }],
    })),
    rounds,
  } as Match;
}

function playedRound(standings: Standing[] = []): Partial<Round> {
  return { id: PLAYED_ROUND_ID, song: { id: 10, title: 'Test Song' }, standings } as Partial<Round>;
}

function handScoredRound(standings: Standing[] = []): Partial<Round> {
  return { id: HAND_SCORED_ROUND_ID, song: null, standings } as Partial<Round>;
}

describe('StandingManager', () => {
  const standingService = {
    findOne: jest.fn(),
    upsert: jest.fn(),
    savePoints: jest.fn(),
    delete: jest.fn(),
  };
  const roundService = {
    findOneWithMatch: jest.fn(),
  };
  const matchService = {
    getMatch: jest.fn(),
    findActiveByTournamentForLobbyLookup: jest.fn(),
  };
  const matchWorkflowManager = {
    assertEditable: jest.fn(),
  };
  const scoreService = {
    create: jest.fn(),
    findOne: jest.fn(),
  };
  const scoringSystem = {
    recalc: jest.fn(),
  };
  const scoringSystemProvider = {
    getScoringSystem: jest.fn(() => scoringSystem),
  };
  const uiUpdateGateway = {
    emitMatchUpdateByMatchId: jest.fn(),
    emitWarning: jest.fn(),
  };

  const manager = new StandingManager(
    standingService as unknown as StandingService,
    roundService as unknown as RoundService,
    matchService as unknown as MatchService,
    matchWorkflowManager as unknown as MatchWorkflowManager,
    scoreService as unknown as ScoreService,
    scoringSystemProvider as unknown as ScoringSystemProvider,
    uiUpdateGateway as unknown as UiUpdatePublisher,
  );

  /** Both entry points reach a round the same way: the round names its match. */
  function loads(currentMatch: Match, roundId: number): void {
    roundService.findOneWithMatch.mockResolvedValue({ id: roundId, match: { id: currentMatch.id } });
    matchService.getMatch.mockResolvedValue(currentMatch);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    /* clearAllMocks keeps implementations, and a ranking left behind by one
       test would run against another test's standings. */
    scoringSystem.recalc.mockImplementation(() => undefined);
  });

  it('does not calculate points until every singles player has a standing', async () => {
    const firstPlayer = player(1);
    const currentMatch = match([firstPlayer, player(2)], [playedRound()]);
    const firstScore = score(100, firstPlayer, 99);
    const saved = standing(200, firstPlayer, firstScore);
    loads(currentMatch, PLAYED_ROUND_ID);
    scoreService.create.mockResolvedValue(firstScore);
    standingService.upsert.mockResolvedValue(saved);

    await manager.upsertScore(PLAYED_ROUND_ID, firstPlayer.id, { percentage: 99, isFailed: false });

    expect(currentMatch.rounds[0].standings).toEqual([saved]);
    expect(scoringSystemProvider.getScoringSystem).not.toHaveBeenCalled();
    expect(standingService.savePoints).not.toHaveBeenCalled();
    expect(uiUpdateGateway.emitMatchUpdateByMatchId).toHaveBeenCalledWith(currentMatch.id);
  });

  it('calculates and persists points when the round becomes complete', async () => {
    const firstPlayer = player(1);
    const secondPlayer = player(2);
    const firstStanding = standing(200, firstPlayer, score(100, firstPlayer, 99));
    const currentMatch = match([firstPlayer, secondPlayer], [playedRound([firstStanding])]);
    const secondScore = score(101, secondPlayer, 98);
    const secondStanding = standing(201, secondPlayer, secondScore);
    loads(currentMatch, PLAYED_ROUND_ID);
    scoreService.create.mockResolvedValue(secondScore);
    standingService.upsert.mockResolvedValue(secondStanding);
    scoringSystem.recalc.mockImplementation((currentStandings: Standing[]) => {
      currentStandings[0].points = 2;
      currentStandings[1].points = 1;
    });

    await manager.upsertScore(PLAYED_ROUND_ID, secondPlayer.id, { percentage: 98, isFailed: false });

    expect(scoringSystemProvider.getScoringSystem).toHaveBeenCalledWith('EurocupScoreCalculator');
    expect(scoringSystem.recalc).toHaveBeenCalledWith(currentMatch.rounds[0].standings);
    expect(standingService.savePoints).toHaveBeenCalledWith(currentMatch.rounds[0].standings);
  });

  it('replaces the standing of a player instead of adding a second one', async () => {
    const currentPlayer = player(1);
    const existing = standing(200, currentPlayer, score(100, currentPlayer, 95), 1);
    const currentMatch = match([currentPlayer], [playedRound([existing])]);
    const replacementScore = score(101, currentPlayer, 99);
    const replaced = standing(200, currentPlayer, replacementScore);
    loads(currentMatch, PLAYED_ROUND_ID);
    scoreService.create.mockResolvedValue(replacementScore);
    standingService.upsert.mockResolvedValue(replaced);

    await manager.upsertScore(PLAYED_ROUND_ID, currentPlayer.id, { percentage: 99, isFailed: false });

    expect(currentMatch.rounds[0].standings).toEqual([replaced]);
    expect(standingService.upsert).toHaveBeenCalledWith(PLAYED_ROUND_ID, currentPlayer.id, {
      score: replacementScore,
      points: 0,
    });
  });

  it('writes stated points on a hand-scored round without ranking anything', async () => {
    const currentPlayer = player(1);
    const currentMatch = match([currentPlayer], [handScoredRound()]);
    const saved = standing(300, currentPlayer, undefined, 7);
    loads(currentMatch, HAND_SCORED_ROUND_ID);
    standingService.upsert.mockResolvedValue(saved);

    await manager.upsertPoints(HAND_SCORED_ROUND_ID, currentPlayer.id, 7);

    expect(standingService.upsert).toHaveBeenCalledWith(HAND_SCORED_ROUND_ID, currentPlayer.id, {
      score: null,
      points: 7,
    });
    expect(scoreService.create).not.toHaveBeenCalled();
    expect(scoringSystemProvider.getScoringSystem).not.toHaveBeenCalled();
    expect(uiUpdateGateway.emitMatchUpdateByMatchId).toHaveBeenCalledWith(currentMatch.id);
  });

  it('refuses stated points on a round that has a song', async () => {
    const currentPlayer = player(1);
    loads(match([currentPlayer], [playedRound()]), PLAYED_ROUND_ID);

    await expect(manager.upsertPoints(PLAYED_ROUND_ID, currentPlayer.id, 3)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(standingService.upsert).not.toHaveBeenCalled();
  });

  it('refuses a played score on a hand-scored round', async () => {
    const currentPlayer = player(1);
    loads(match([currentPlayer], [handScoredRound()]), HAND_SCORED_ROUND_ID);

    await expect(
      manager.upsertScore(HAND_SCORED_ROUND_ID, currentPlayer.id, { percentage: 99, isFailed: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(standingService.upsert).not.toHaveBeenCalled();
  });

  it('rejects score changes when the match workflow is not editable', async () => {
    const currentPlayer = player(1);
    loads(match([currentPlayer], [playedRound()]), PLAYED_ROUND_ID);
    const workflowError = new Error('Match is not editable');
    matchWorkflowManager.assertEditable.mockImplementationOnce(() => {
      throw workflowError;
    });

    await expect(
      manager.upsertScore(PLAYED_ROUND_ID, currentPlayer.id, { percentage: 99, isFailed: false }),
    ).rejects.toBe(workflowError);

    expect(standingService.upsert).not.toHaveBeenCalled();
    expect(uiUpdateGateway.emitMatchUpdateByMatchId).not.toHaveBeenCalled();
  });
});
