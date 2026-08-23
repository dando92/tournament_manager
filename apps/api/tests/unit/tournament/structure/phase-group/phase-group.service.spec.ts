import { PhaseGroup } from '@tournament-manager/persistence';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';
import { PhaseGroupService } from '@tournament/structure/phase-group/phase-group.service';

describe('PhaseGroupService.createForPhase', () => {
  const phaseGroupRepository = {
    find: jest.fn(),
    save: jest.fn(),
  };
  const phaseRepository = {
    findOneBy: jest.fn(),
  };
  const uiUpdateGateway = {
    emitPhaseUpdateByPhaseId: jest.fn(),
    emitPhaseGroupUpdateByPhaseGroupId: jest.fn(),
  };

  const service = new PhaseGroupService(
    phaseGroupRepository as never,
    {} as never,
    phaseRepository as never,
    {} as never,
    uiUpdateGateway as unknown as UiUpdatePublisher,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    phaseRepository.findOneBy.mockResolvedValue({ id: 3 });
    phaseGroupRepository.save.mockImplementation(async (phaseGroup: PhaseGroup) => ({ ...phaseGroup, id: 9 }));
  });

  it('names the first group of a phase after the first free letter', async () => {
    phaseGroupRepository.find.mockResolvedValue([]);

    const phaseGroup = await service.createForPhase(3, {});

    expect(phaseGroup.displayIdentifier).toBe('A');
    expect(phaseGroup.name).toBe('A');
  });

  it('skips the letters already taken in the same phase', async () => {
    phaseGroupRepository.find.mockResolvedValue([
      { displayIdentifier: 'A' },
      { displayIdentifier: 'B' },
    ]);

    const phaseGroup = await service.createForPhase(3, {});

    expect(phaseGroup.displayIdentifier).toBe('C');
  });

  it('keeps an explicit identifier and name, so a start.gg import stays faithful', async () => {
    phaseGroupRepository.find.mockResolvedValue([]);

    const phaseGroup = await service.createForPhase(3, { name: 'Pool 12', displayIdentifier: 'L' });

    expect(phaseGroup.displayIdentifier).toBe('L');
    expect(phaseGroup.name).toBe('Pool 12');
  });
});

describe('PhaseGroupService.syncDerivedEntrants', () => {
  const phaseGroupRepository = {
    findOne: jest.fn(),
  };
  const phaseGroupEntrantRepository = {
    find: jest.fn(),
    remove: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const entrantRepository = {
    findOneBy: jest.fn(),
  };
  const uiUpdateGateway = {
    emitPhaseGroupUpdateByPhaseGroupId: jest.fn(),
  };

  const service = new PhaseGroupService(
    phaseGroupRepository as never,
    phaseGroupEntrantRepository as never,
    {} as never,
    entrantRepository as never,
    uiUpdateGateway as unknown as UiUpdatePublisher,
  );

  function phaseGroupWithMatchEntrants(entrantIds: number[][]) {
    return {
      id: 5,
      matches: entrantIds.map((ids) => ({ entrants: ids.map((id) => ({ id })) })),
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    phaseGroupEntrantRepository.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ max: 0 }),
    });
    entrantRepository.findOneBy.mockImplementation(async ({ id }: { id: number }) => ({ id, name: `Entrant ${id}`, seedNum: id }));
    phaseGroupEntrantRepository.save.mockImplementation(async (entry: unknown) => entry);
  });

  it('adds an entrant that a match introduced', async () => {
    phaseGroupRepository.findOne.mockResolvedValue(phaseGroupWithMatchEntrants([[11, 12]]));
    phaseGroupEntrantRepository.find.mockResolvedValue([]);

    await service.syncDerivedEntrants(5);

    expect(phaseGroupEntrantRepository.save).toHaveBeenCalledTimes(2);
    expect(phaseGroupEntrantRepository.remove).not.toHaveBeenCalled();
  });

  it('gives the slots in division seeding order', async () => {
    phaseGroupRepository.findOne.mockResolvedValue(phaseGroupWithMatchEntrants([[21, 20]]));
    phaseGroupEntrantRepository.find.mockResolvedValue([]);
    entrantRepository.findOneBy.mockImplementation(async ({ id }: { id: number }) => ({
      id,
      name: `Entrant ${id}`,
      seedNum: id === 21 ? 1 : 2,
    }));

    await service.syncDerivedEntrants(5);

    const savedOrder = phaseGroupEntrantRepository.save.mock.calls.map(([entry]) => entry.entrant.id);
    expect(savedOrder).toEqual([21, 20]);
  });

  it('removes an entrant that no match mentions any more', async () => {
    const staleEntry = { id: 90, entrant: { id: 12 }, sourceAdvancementRule: null };
    phaseGroupRepository.findOne.mockResolvedValue(phaseGroupWithMatchEntrants([[11]]));
    phaseGroupEntrantRepository.find.mockResolvedValue([
      { id: 89, entrant: { id: 11 }, sourceAdvancementRule: null },
      staleEntry,
    ]);

    await service.syncDerivedEntrants(5);

    expect(phaseGroupEntrantRepository.remove).toHaveBeenCalledTimes(1);
    expect(phaseGroupEntrantRepository.remove).toHaveBeenCalledWith(staleEntry);
  });

  it('keeps an entrant an advancement placed here before its matches exist', async () => {
    phaseGroupRepository.findOne.mockResolvedValue(phaseGroupWithMatchEntrants([]));
    phaseGroupEntrantRepository.find.mockResolvedValue([
      { id: 91, entrant: { id: 13 }, sourceAdvancementRule: { id: 4 } },
    ]);

    await service.syncDerivedEntrants(5);

    expect(phaseGroupEntrantRepository.remove).not.toHaveBeenCalled();
    expect(uiUpdateGateway.emitPhaseGroupUpdateByPhaseGroupId).not.toHaveBeenCalled();
  });
});
