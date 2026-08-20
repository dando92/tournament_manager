import { Match, Player, Score, Standing } from '@tournament-manager/persistence';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';
import { MatchService } from '@match/services/match.service';
import { MatchWorkflowManager } from '@match/services/match-workflow.manager';

import { ScoreService } from '@tournament/competition/services/score.service';
import { ScoringSystemProvider } from '@tournament-manager/scoring';
import { StandingManager } from '@tournament/competition/standing/standing.manager';
import { StandingService } from '@tournament/competition/standing/standing.service';

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

function match(players: Player[], standings: Standing[] = []): Match {
  return {
    id: 20,
    scoringSystem: 'EurocupScoreCalculator',
    entrants: players.map((entrantPlayer, index) => ({
      id: index + 1,
      type: 'player',
      participants: [{ player: entrantPlayer }],
    })),
    rounds: [{ id: 30, song: { id: 10 }, standings }],
  } as Match;
}

describe('StandingManager', () => {
  const standingService = {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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
    matchService as unknown as MatchService,
    matchWorkflowManager as unknown as MatchWorkflowManager,
    scoreService as unknown as ScoreService,
    scoringSystemProvider as unknown as ScoringSystemProvider,
    uiUpdateGateway as unknown as UiUpdatePublisher,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not calculate points until every singles player has a score', async () => {
    const firstPlayer = player(1);
    const currentMatch = match([firstPlayer, player(2)]);
    const firstScore = score(100, firstPlayer, 99);
    const createdStanding = { id: 200, score: firstScore, points: 0 } as Standing;
    standingService.create.mockResolvedValue(createdStanding);

    await manager.AddScoreToMatch(currentMatch, firstScore);

    expect(currentMatch.rounds[0].standings).toEqual([createdStanding]);
    expect(scoringSystemProvider.getScoringSystem).not.toHaveBeenCalled();
    expect(standingService.update).not.toHaveBeenCalled();
    expect(uiUpdateGateway.emitMatchUpdateByMatchId).toHaveBeenCalledWith(currentMatch.id);
  });

  it('calculates and persists points when the round becomes complete', async () => {
    const firstPlayer = player(1);
    const secondPlayer = player(2);
    const firstStanding = {
      id: 200,
      score: score(100, firstPlayer, 99),
      points: 0,
    } as Standing;
    const currentMatch = match([firstPlayer, secondPlayer], [firstStanding]);
    const secondScore = score(101, secondPlayer, 98);
    const secondStanding = { id: 201, score: secondScore, points: 0 } as Standing;
    standingService.create.mockResolvedValue(secondStanding);
    scoringSystem.recalc.mockImplementation((currentStandings: Standing[]) => {
      currentStandings[0].points = 2;
      currentStandings[1].points = 1;
    });

    await manager.AddScoreToMatch(currentMatch, secondScore);

    expect(scoringSystemProvider.getScoringSystem).toHaveBeenCalledWith('EurocupScoreCalculator');
    expect(scoringSystem.recalc).toHaveBeenCalledWith(currentMatch.rounds[0].standings);
    expect(standingService.update).toHaveBeenNthCalledWith(1, 200, { points: 2 });
    expect(standingService.update).toHaveBeenNthCalledWith(2, 201, { points: 1 });
    expect(uiUpdateGateway.emitMatchUpdateByMatchId).toHaveBeenCalledWith(currentMatch.id);
  });

  it('replaces an existing player score instead of creating a duplicate standing', async () => {
    const currentPlayer = player(1);
    const originalScore = score(100, currentPlayer, 95);
    const existingStanding = { id: 200, score: originalScore, points: 1 } as Standing;
    const currentMatch = match([currentPlayer], [existingStanding]);
    const replacementScore = score(101, currentPlayer, 99);
    scoringSystem.recalc.mockImplementation((currentStandings: Standing[]) => {
      currentStandings[0].points = 1;
    });

    await manager.AddScoreToMatch(currentMatch, replacementScore);

    expect(standingService.create).not.toHaveBeenCalled();
    expect(existingStanding.score).toBe(replacementScore);
    expect(standingService.update).toHaveBeenNthCalledWith(1, existingStanding.id, {
      scoreId: replacementScore.id,
      points: 0,
    });
    expect(standingService.update).toHaveBeenNthCalledWith(2, existingStanding.id, { points: 1 });
  });

  it('rejects score changes when the match workflow is not editable', async () => {
    const currentPlayer = player(1);
    const currentMatch = match([currentPlayer]);
    const workflowError = new Error('Match is not editable');
    matchWorkflowManager.assertEditable.mockImplementationOnce(() => {
      throw workflowError;
    });

    await expect(manager.AddScoreToMatch(currentMatch, score(100, currentPlayer, 99))).rejects.toBe(workflowError);

    expect(standingService.create).not.toHaveBeenCalled();
    expect(uiUpdateGateway.emitMatchUpdateByMatchId).not.toHaveBeenCalled();
  });
});

