import { Division, Phase } from '@tournament-manager/persistence';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';
import { PhaseGroupService } from '@tournament/structure/services/phase-group.service';
import { PhaseService } from '@tournament/structure/services/phase.service';

describe('PhaseService', () => {
  const phaseRepository = {
    save: jest.fn(),
  };
  const divisionRepository = {
    findOneBy: jest.fn(),
  };
  const phaseGroupService = {
    createForPhase: jest.fn(),
  };
  const uiUpdateGateway = {
    emitDivisionUpdateByDivisionId: jest.fn(),
  };

  const service = new PhaseService(
    phaseRepository as never,
    divisionRepository as never,
    phaseGroupService as unknown as PhaseGroupService,
    uiUpdateGateway as unknown as UiUpdatePublisher,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    divisionRepository.findOneBy.mockResolvedValue({ id: 7 } as Division);
    phaseRepository.save.mockImplementation(async (phase: Phase) => ({ ...phase, id: 42 }));
  });

  it('gives a newly created phase a default phase group', async () => {
    const phase = await service.createWithDefaultPhaseGroup({ divisionId: 7, name: 'Qualifiers' });

    expect(phase.id).toBe(42);
    expect(phaseGroupService.createForPhase).toHaveBeenCalledTimes(1);
    expect(phaseGroupService.createForPhase).toHaveBeenCalledWith(42, {
      name: 'Qualifiers',
      displayIdentifier: '1',
    });
  });

  it('leaves the plain create without a phase group so importers own their own structure', async () => {
    await service.create({ divisionId: 7, name: 'Qualifiers' });

    expect(phaseGroupService.createForPhase).not.toHaveBeenCalled();
  });
});
