import { BadRequestException } from '@nestjs/common';
import { Entrant, Match, MatchResult, Player, Standing } from '@tournament-manager/persistence';
import { StartggService } from '@api/integrations/startgg/startgg.service';

import { AdvancementManager } from '@match/services/advancement.manager';
import { MatchResultService } from '@match/services/match-result.service';
import { MatchService } from '@match/services/match.service';
import { MatchWorkflowManager } from '@match/services/match-workflow.manager';

function entrant(id: number, playerId: number): Entrant {
  return {
    id,
    type: 'player',
    participants: [{ player: { id: playerId } as Player }],
  } as Entrant;
}

function standing(playerId: number, points: number): Standing {
  return {
    points,
    player: { id: playerId } as Player,
  } as Standing;
}

/**
 * A hand-scored match is an ordinary match whose single round has no song.
 * The commit path does not know the difference, which is the point.
 */
function handScoredMatch(): Match {
  return {
    id: 10,
    active: false,
    entrants: [entrant(1, 101), entrant(2, 102)],
    rounds: [{ song: null, standings: [standing(101, 3), standing(102, 1)] }],
    matchResult: null,
  } as Match;
}

describe('MatchWorkflowManager', () => {
  const matchService = {
    getMatch: jest.fn(),
    updateActive: jest.fn(),
  };
  const matchResultService = {
    upsertForMatch: jest.fn(),
    deleteForMatch: jest.fn(),
  };
  const advancementManager = {
    AdvanceFromCompletedMatch: jest.fn(),
    RevertAdvancementFromMatch: jest.fn(),
  };
  const startggService = {
    reportCompletedMatch: jest.fn(),
  };

  const manager = new MatchWorkflowManager(
    matchService as unknown as MatchService,
    matchResultService as unknown as MatchResultService,
    advancementManager as unknown as AdvancementManager,
    startggService as unknown as StartggService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    startggService.reportCompletedMatch.mockResolvedValue([{ id: '1' }]);
  });

  it('aggregates populated round standings before persisting and advancing a result', async () => {
    const currentMatch = {
      id: 10,
      active: true,
      entrants: [entrant(1, 101), entrant(2, 102)],
      rounds: [
        { standings: [standing(101, 2), standing(102, 1)] },
        { standings: [standing(101, 1), standing(102, 2)] },
      ],
      matchResult: null,
    } as Match;
    const savedResult = {
      id: 20,
      playerPoints: [
        { playerId: 101, points: 3 },
        { playerId: 102, points: 3 },
      ],
    } as MatchResult;
    const reloadedMatch = { ...currentMatch, active: false, matchResult: savedResult } as Match;
    matchService.getMatch.mockResolvedValueOnce(currentMatch).mockResolvedValueOnce(reloadedMatch);
    matchResultService.upsertForMatch.mockResolvedValue(savedResult);
    matchService.updateActive.mockResolvedValue({ ...currentMatch, active: false });

    const result = await manager.CommitMatchResult(currentMatch.id);

    expect(matchResultService.upsertForMatch).toHaveBeenCalledWith(currentMatch.id, savedResult.playerPoints);
    expect(matchService.updateActive).toHaveBeenCalledWith(currentMatch.id, false);
    expect(advancementManager.AdvanceFromCompletedMatch).toHaveBeenCalledWith(currentMatch);
    expect(startggService.reportCompletedMatch).toHaveBeenCalledWith(currentMatch.id);
    expect(result.match).toBe(reloadedMatch);
    expect(result.startggReport).toBe('reported');
  });

  it('completes a match that start.gg reporting skips because it is not linked', async () => {
    const currentMatch = handScoredMatch();
    matchService.getMatch.mockResolvedValue(currentMatch);
    matchResultService.upsertForMatch.mockResolvedValue({ id: 20, playerPoints: [] } as MatchResult);
    startggService.reportCompletedMatch.mockResolvedValue(null);

    const result = await manager.CommitMatchResult(currentMatch.id);

    expect(result.startggReport).toBe('skipped');
  });

  it('completes a match even when start.gg reporting fails', async () => {
    const currentMatch = handScoredMatch();
    matchService.getMatch.mockResolvedValue(currentMatch);
    matchResultService.upsertForMatch.mockResolvedValue({ id: 20, playerPoints: [] } as MatchResult);
    startggService.reportCompletedMatch.mockRejectedValue(new Error('start.gg unavailable'));

    const result = await manager.CommitMatchResult(currentMatch.id);

    expect(matchResultService.upsertForMatch).toHaveBeenCalled();
    expect(result.startggReport).toBe('failed');
  });

  it('rejects completion when a round played on a song is missing a player standing', async () => {
    const currentMatch = {
      id: 10,
      entrants: [entrant(1, 101), entrant(2, 102)],
      rounds: [{ song: { id: 1, title: 'Test Song' }, standings: [standing(101, 2)] }],
    } as Match;
    matchService.getMatch.mockResolvedValue(currentMatch);

    await expect(manager.CommitMatchResult(currentMatch.id)).rejects.toThrow(
      new BadRequestException('Match 10 cannot be completed because not all standings are populated'),
    );

    expect(matchResultService.upsertForMatch).not.toHaveBeenCalled();
    expect(advancementManager.AdvanceFromCompletedMatch).not.toHaveBeenCalled();
    expect(startggService.reportCompletedMatch).not.toHaveBeenCalled();
  });

  it('sums a hand-scored round exactly like a played one', async () => {
    const currentMatch = handScoredMatch();
    const savedResult = { id: 20, playerPoints: [] } as MatchResult;
    matchService.getMatch.mockResolvedValue(currentMatch);
    matchResultService.upsertForMatch.mockResolvedValue(savedResult);

    await manager.CommitMatchResult(currentMatch.id);

    expect(matchResultService.upsertForMatch).toHaveBeenCalledWith(currentMatch.id, [
      { playerId: 101, points: 3 },
      { playerId: 102, points: 1 },
    ]);
  });

  it('completes a hand-scored match that nobody but the winner has points in', async () => {
    const currentMatch = {
      id: 10,
      active: false,
      entrants: [entrant(1, 101), entrant(2, 102)],
      rounds: [{ song: null, standings: [standing(101, 1)] }],
      matchResult: null,
    } as Match;
    matchService.getMatch.mockResolvedValue(currentMatch);
    matchResultService.upsertForMatch.mockResolvedValue({ id: 20, playerPoints: [] } as MatchResult);

    await manager.CommitMatchResult(currentMatch.id);

    /* One to nothing is a result: the player nobody gave points to scored none,
       and is not something the match is still waiting for. */
    expect(matchResultService.upsertForMatch).toHaveBeenCalledWith(currentMatch.id, [
      { playerId: 101, points: 1 },
      { playerId: 102, points: 0 },
    ]);
  });

  it('refuses to complete a hand-scored match while every point is zero', async () => {
    const currentMatch = {
      id: 10,
      active: false,
      entrants: [entrant(1, 101), entrant(2, 102)],
      rounds: [{ song: null, standings: [standing(101, 0), standing(102, 0)] }],
      matchResult: null,
    } as Match;
    matchService.getMatch.mockResolvedValue(currentMatch);

    await expect(manager.CommitMatchResult(currentMatch.id)).rejects.toThrow(BadRequestException);
    expect(matchResultService.upsertForMatch).not.toHaveBeenCalled();
  });

  it('refuses to complete a match that has no rounds at all', async () => {
    const currentMatch = {
      id: 10,
      active: false,
      entrants: [entrant(1, 101)],
      rounds: [],
      matchResult: null,
    } as Match;
    matchService.getMatch.mockResolvedValue(currentMatch);

    await expect(manager.CommitMatchResult(currentMatch.id)).rejects.toThrow(BadRequestException);
    expect(matchResultService.upsertForMatch).not.toHaveBeenCalled();
  });

  it('reverts previous advancement before replacing a completed result', async () => {
    const previousResult = { id: 19, playerPoints: [{ playerId: 101, points: 1 }] } as MatchResult;
    const currentMatch = {
      id: 10,
      active: false,
      entrants: [entrant(1, 101)],
      rounds: [{ song: null, standings: [standing(101, 2)] }],
      matchResult: previousResult,
    } as Match;
    matchService.getMatch.mockResolvedValue(currentMatch);
    matchResultService.upsertForMatch.mockResolvedValue({ id: 20, playerPoints: [] });

    await manager.CommitMatchResult(currentMatch.id);

    expect(advancementManager.RevertAdvancementFromMatch).toHaveBeenCalledWith(currentMatch);
    expect(matchResultService.upsertForMatch).toHaveBeenCalledWith(currentMatch.id, [
      { playerId: 101, points: 2 },
    ]);
    expect(advancementManager.AdvanceFromCompletedMatch).toHaveBeenCalledWith(currentMatch);
  });

  it('reopens a completed match by reverting advancement and deleting its result', async () => {
    const currentMatch = {
      id: 10,
      active: true,
      matchResult: { id: 20, playerPoints: [] },
    } as Match;
    const reopenedMatch = { ...currentMatch, active: false, matchResult: null } as Match;
    matchService.getMatch.mockResolvedValueOnce(currentMatch).mockResolvedValueOnce(reopenedMatch);

    const result = await manager.ReopenMatchResult(currentMatch.id);

    expect(advancementManager.RevertAdvancementFromMatch).toHaveBeenCalledWith(currentMatch);
    expect(matchResultService.deleteForMatch).toHaveBeenCalledWith(currentMatch.id);
    expect(matchService.updateActive).toHaveBeenCalledWith(currentMatch.id, false);
    expect(result).toBe(reopenedMatch);
  });

  it('does not allow a completed match to be activated', async () => {
    const currentMatch = {
      id: 10,
      active: false,
      matchResult: { id: 20, playerPoints: [] },
    } as Match;
    matchService.getMatch.mockResolvedValue(currentMatch);

    await expect(manager.UpdateMatchActive(currentMatch.id, { active: true })).rejects.toThrow(
      new BadRequestException('Completed matches must be re-opened before activation'),
    );

    expect(matchService.updateActive).not.toHaveBeenCalled();
  });
});
