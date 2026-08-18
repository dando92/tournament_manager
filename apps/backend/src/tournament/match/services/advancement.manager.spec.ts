import { AdvancementRule, Entrant, Match, Player } from '@persistence/entities';
import { UiUpdateGateway } from '@match/gateways/ui-update.gateway';
import { AdvancementRuleService } from '@tournament/services/advancement-rule.service';
import { PhaseGroupService } from '@tournament/services/phase-group.service';

import { AdvancementManager } from './advancement.manager';
import { MatchService } from './match.service';

function entrant(id: number, playerId: number): Entrant {
  return {
    id,
    name: `Entrant ${id}`,
    type: 'player',
    participants: [{ player: { id: playerId } as Player }],
  } as Entrant;
}

function completedMatch(id: number, entrants: Entrant[], playerPoints: Array<{ playerId: number; points: number }>): Match {
  return {
    id,
    entrants,
    matchResult: { id: id + 1000, playerPoints },
  } as Match;
}

function rule(overrides: Partial<AdvancementRule>): AdvancementRule {
  return {
    id: 1,
    sourceKind: 'match',
    sourceId: 10,
    sourcePlacement: 1,
    targetKind: 'match',
    targetId: 20,
    targetSlot: 1,
    ...overrides,
  } as AdvancementRule;
}

describe('AdvancementManager', () => {
  const matchService = {
    getMatch: jest.fn(),
    update: jest.fn(),
  };
  const advancementRuleService = {
    findBySource: jest.fn(),
  };
  const phaseGroupService = {
    addEntrant: jest.fn(),
    removeEntrant: jest.fn(),
    findOne: jest.fn(),
    markEntrantsAdvanced: jest.fn(),
    update: jest.fn(),
  };
  const uiUpdateGateway = {
    emitMatchUpdateByMatchId: jest.fn(),
  };

  const manager = new AdvancementManager(
    matchService as unknown as MatchService,
    advancementRuleService as unknown as AdvancementRuleService,
    phaseGroupService as unknown as PhaseGroupService,
    uiUpdateGateway as unknown as UiUpdateGateway,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('places match-result entrants into configured target slots and emits one update per target match', async () => {
    const winner = entrant(1, 101);
    const runnerUp = entrant(2, 102);
    const existingTargetEntrant = entrant(3, 103);
    const sourceMatch = completedMatch(10, [runnerUp, winner], [
      { playerId: 101, points: 3 },
      { playerId: 102, points: 1 },
    ]);
    const targetMatch = { id: 20, entrants: [existingTargetEntrant] } as Match;
    advancementRuleService.findBySource.mockResolvedValue([
      rule({ id: 11, sourcePlacement: 1, targetSlot: 2 }),
      rule({ id: 12, sourcePlacement: 2, targetSlot: 1 }),
    ]);
    matchService.getMatch.mockResolvedValue(targetMatch);

    await manager.AdvanceFromCompletedMatch(sourceMatch);

    expect(matchService.update).toHaveBeenNthCalledWith(1, 20, {
      entrantIds: [existingTargetEntrant.id, winner.id],
    });
    expect(matchService.update).toHaveBeenNthCalledWith(2, 20, {
      entrantIds: [runnerUp.id, existingTargetEntrant.id],
    });
    expect(uiUpdateGateway.emitMatchUpdateByMatchId).toHaveBeenCalledTimes(1);
    expect(uiUpdateGateway.emitMatchUpdateByMatchId).toHaveBeenCalledWith(20);
  });

  it('does not duplicate an entrant already present in a target match', async () => {
    const winner = entrant(1, 101);
    const existingTargetEntrant = entrant(3, 103);
    const sourceMatch = completedMatch(10, [winner], [{ playerId: 101, points: 3 }]);
    const targetMatch = { id: 20, entrants: [winner, existingTargetEntrant] } as Match;
    advancementRuleService.findBySource.mockResolvedValue([rule({ targetSlot: 2 })]);
    matchService.getMatch.mockResolvedValue(targetMatch);

    await manager.AdvanceFromCompletedMatch(sourceMatch);

    expect(matchService.update).toHaveBeenCalledWith(20, {
      entrantIds: [existingTargetEntrant.id, winner.id],
    });
  });

  it('completes a phase group only after every match has a result and advances aggregate placement', async () => {
    const firstEntrant = entrant(1, 101);
    const secondEntrant = entrant(2, 102);
    const firstMatch = completedMatch(10, [firstEntrant, secondEntrant], [
      { playerId: 101, points: 3 },
      { playerId: 102, points: 1 },
    ]);
    const secondMatch = completedMatch(11, [firstEntrant, secondEntrant], [
      { playerId: 101, points: 0 },
      { playerId: 102, points: 2 },
    ]);
    firstMatch.phaseGroup = { id: 30 } as Match['phaseGroup'];
    advancementRuleService.findBySource.mockImplementation((sourceKind: string) =>
      Promise.resolve(sourceKind === 'phase_group'
        ? [rule({ id: 50, sourceKind: 'phase_group', sourceId: 30, targetKind: 'phase_group', targetId: 40 })]
        : []),
    );
    phaseGroupService.findOne.mockResolvedValue({ id: 30, matches: [firstMatch, secondMatch] });

    await manager.AdvanceFromCompletedMatch(firstMatch);

    expect(phaseGroupService.addEntrant).toHaveBeenCalledWith(40, firstEntrant.id, 1, 50);
    expect(phaseGroupService.markEntrantsAdvanced).toHaveBeenCalledWith(30, [firstEntrant.id]);
    expect(phaseGroupService.update).toHaveBeenCalledWith(30, { state: 'completed' });
  });

  it('leaves a phase group active while any match result is missing', async () => {
    const firstEntrant = entrant(1, 101);
    const sourceMatch = completedMatch(10, [firstEntrant], [{ playerId: 101, points: 1 }]);
    sourceMatch.phaseGroup = { id: 30 } as Match['phaseGroup'];
    advancementRuleService.findBySource.mockResolvedValue([]);
    phaseGroupService.findOne.mockResolvedValue({
      id: 30,
      matches: [sourceMatch, { id: 11, matchResult: null }],
    });

    await manager.AdvanceFromCompletedMatch(sourceMatch);

    expect(phaseGroupService.markEntrantsAdvanced).not.toHaveBeenCalled();
    expect(phaseGroupService.update).not.toHaveBeenCalled();
  });

  it('removes previously advanced entrants and reopens their phase group', async () => {
    const winner = entrant(1, 101);
    const sourceMatch = completedMatch(10, [winner], [{ playerId: 101, points: 1 }]);
    sourceMatch.phaseGroup = { id: 30 } as Match['phaseGroup'];
    const matchRule = rule({ targetKind: 'match', targetId: 20 });
    const phaseGroupRule = rule({
      id: 2,
      sourceKind: 'phase_group',
      sourceId: 30,
      targetKind: 'phase_group',
      targetId: 40,
    });
    advancementRuleService.findBySource.mockImplementation((sourceKind: string) =>
      Promise.resolve(sourceKind === 'phase_group' ? [phaseGroupRule] : [matchRule]),
    );
    matchService.getMatch.mockResolvedValue({ id: 20, entrants: [winner] });
    phaseGroupService.findOne.mockResolvedValue({ id: 30, matches: [sourceMatch] });

    await manager.RevertAdvancementFromMatch(sourceMatch);

    expect(matchService.update).toHaveBeenCalledWith(20, { entrantIds: [] });
    expect(phaseGroupService.removeEntrant).toHaveBeenCalledWith(40, winner.id);
    expect(phaseGroupService.markEntrantsAdvanced).toHaveBeenCalledWith(30, []);
    expect(phaseGroupService.update).toHaveBeenCalledWith(30, { state: 'active' });
  });
});
