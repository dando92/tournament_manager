import { AdvancementRule, Entrant, Match, MatchResult, Player } from '@tournament-manager/persistence';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';
import { AdvancementRuleService } from '@tournament/structure/services/advancement-rule.service';
import { PhaseGroupService } from '@tournament/structure/phase-group/phase-group.service';

import { AdvancementManager } from '@match/services/advancement.manager';
import { MatchAggregate } from '@match/match.aggregate';
import { ScoringSystemProvider } from '@tournament-manager/scoring';
import { MatchStore } from '@match/match.store';

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
    phaseGroup: { id: 30 },
    matchResult: { id: id + 1000, playerPoints } as MatchResult,
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
  const matchStore = {
    load: jest.fn(),
    save: jest.fn(),
  };
  const advancementRuleService = {
    findBySource: jest.fn(),
  };
  const phaseGroupService = {
    addEntrant: jest.fn(),
    removeEntrant: jest.fn(),
    findOne: jest.fn(),
    markEntrantsAdvanced: jest.fn(),
    syncDerivedEntrants: jest.fn(),
    update: jest.fn(),
  };
  const publisher = {
    emitMatchUpdate: jest.fn(),
    emitPhaseGroupUpdate: jest.fn(),
  };

  const manager = new AdvancementManager(
    matchStore as unknown as MatchStore,
    advancementRuleService as unknown as AdvancementRuleService,
    phaseGroupService as unknown as PhaseGroupService,
    publisher as unknown as UiUpdatePublisher,
    { getScoringSystem: () => ({ recalc: jest.fn() }) } as unknown as ScoringSystemProvider,
  );

  /** What the store handed back, which is what the save was called with. */
  function savedEntrantIds(call: number): number[] {
    const saved = matchStore.save.mock.calls[call][0] as MatchAggregate;

    return saved.entrants.map((each) => each.id);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    advancementRuleService.findBySource.mockResolvedValue([]);
    phaseGroupService.findOne.mockResolvedValue(null);
  });

  it('places result entrants into the slots their rules name', async () => {
    const winner = entrant(1, 101);
    const runnerUp = entrant(2, 102);
    const alreadyThere = entrant(3, 103);
    const source = MatchAggregate.of(completedMatch(10, [runnerUp, winner], [
      { playerId: 101, points: 3 },
      { playerId: 102, points: 1 },
    ]));
    advancementRuleService.findBySource.mockImplementation((sourceKind: string) =>
      Promise.resolve(sourceKind === 'match'
        ? [rule({ id: 11, sourcePlacement: 1, targetSlot: 2 }), rule({ id: 12, sourcePlacement: 2, targetSlot: 1 })]
        : []),
    );
    matchStore.load.mockImplementation(() =>
      Promise.resolve(MatchAggregate.of({ id: 20, entrants: [alreadyThere], phaseGroup: { id: 31 } } as Match)),
    );

    await manager.advanceFromMatch(source);

    expect(savedEntrantIds(0)).toEqual([alreadyThere.id, winner.id]);
    expect(savedEntrantIds(1)).toEqual([runnerUp.id, alreadyThere.id]);
    expect(publisher.emitMatchUpdate).toHaveBeenCalledTimes(2);
    /* Placing an entrant changes who a match waits on, which is what the pool's
       counts are made of, so each write announces the pool as well. */
    expect(publisher.emitPhaseGroupUpdate).toHaveBeenCalledTimes(2);
  });

  it('does not duplicate an entrant already present in a target match', async () => {
    const winner = entrant(1, 101);
    const alreadyThere = entrant(3, 103);
    const source = MatchAggregate.of(completedMatch(10, [winner], [{ playerId: 101, points: 3 }]));
    advancementRuleService.findBySource.mockImplementation((sourceKind: string) =>
      Promise.resolve(sourceKind === 'match' ? [rule({ targetSlot: 2 })] : []),
    );
    matchStore.load.mockResolvedValue(
      MatchAggregate.of({ id: 20, entrants: [winner, alreadyThere], phaseGroup: { id: 31 } } as Match),
    );

    await manager.advanceFromMatch(source);

    expect(savedEntrantIds(0)).toEqual([alreadyThere.id, winner.id]);
  });

  it('completes a phase group only after every match in it has a result', async () => {
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
    advancementRuleService.findBySource.mockImplementation((sourceKind: string) =>
      Promise.resolve(sourceKind === 'phase_group'
        ? [rule({ id: 50, sourceKind: 'phase_group', sourceId: 30, targetKind: 'phase_group', targetId: 40 })]
        : []),
    );
    phaseGroupService.findOne.mockResolvedValue({ id: 30, matches: [firstMatch, secondMatch] });

    await manager.advanceFromMatch(MatchAggregate.of(firstMatch));

    expect(phaseGroupService.addEntrant).toHaveBeenCalledWith(40, firstEntrant.id, 1, 50);
    expect(phaseGroupService.markEntrantsAdvanced).toHaveBeenCalledWith(30, [firstEntrant.id]);
    expect(phaseGroupService.update).toHaveBeenCalledWith(30, { state: 'completed' });
  });

  it('leaves a phase group active while any match result is missing', async () => {
    const only = entrant(1, 101);
    const source = completedMatch(10, [only], [{ playerId: 101, points: 1 }]);
    phaseGroupService.findOne.mockResolvedValue({
      id: 30,
      matches: [source, { id: 11, matchResult: null }],
    });

    await manager.advanceFromMatch(MatchAggregate.of(source));

    expect(phaseGroupService.markEntrantsAdvanced).not.toHaveBeenCalled();
    expect(phaseGroupService.update).not.toHaveBeenCalled();
  });

  it('removes previously advanced entrants and reopens their phase group', async () => {
    const winner = entrant(1, 101);
    const source = completedMatch(10, [winner], [{ playerId: 101, points: 1 }]);
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
    matchStore.load.mockResolvedValue(
      MatchAggregate.of({ id: 20, entrants: [winner], phaseGroup: { id: 31 } } as Match),
    );
    phaseGroupService.findOne.mockResolvedValue({ id: 30, matches: [source] });

    await manager.revertFromMatch(MatchAggregate.of(source));

    expect(savedEntrantIds(0)).toEqual([]);
    expect(phaseGroupService.removeEntrant).toHaveBeenCalledWith(40, winner.id);
    expect(phaseGroupService.markEntrantsAdvanced).toHaveBeenCalledWith(30, []);
    expect(phaseGroupService.update).toHaveBeenCalledWith(30, { state: 'active' });
  });

  it('leaves a target match alone when the entrant to remove is not in it', async () => {
    const winner = entrant(1, 101);
    const source = completedMatch(10, [winner], [{ playerId: 101, points: 1 }]);
    advancementRuleService.findBySource.mockImplementation((sourceKind: string) =>
      Promise.resolve(sourceKind === 'match' ? [rule({ targetKind: 'match', targetId: 20 })] : []),
    );
    matchStore.load.mockResolvedValue(MatchAggregate.of({ id: 20, entrants: [], phaseGroup: { id: 31 } } as Match));

    await manager.revertFromMatch(MatchAggregate.of(source));

    expect(matchStore.save).not.toHaveBeenCalled();
  });
});
