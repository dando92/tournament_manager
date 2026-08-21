import { PhaseGroup } from '@tournament-manager/persistence';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';
import { PhaseGroupService } from '@tournament/structure/services/phase-group.service';

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
