import { Division, Phase } from '@tournament-manager/persistence';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';
import { PhaseGroupService } from '@tournament/structure/phase-group/phase-group.service';
import { PhaseService } from '@tournament/structure/services/phase.service';

describe('PhaseService', () => {
  const phaseRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
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
    expect(phaseGroupService.createForPhase).toHaveBeenCalledWith(42, {});
  });

  it('leaves the plain create without a phase group so importers own their own structure', async () => {
    await service.create({ divisionId: 7, name: 'Qualifiers' });

    expect(phaseGroupService.createForPhase).not.toHaveBeenCalled();
  });

  it('renames a phase and tells its division to refresh', async () => {
    phaseRepository.findOne.mockResolvedValue({ id: 42, name: 'Qualifiers', division: { id: 7 } } as Phase);

    const phase = await service.update(42, { name: '  Finals  ' });

    expect(phase.name).toBe('Finals');
    expect(uiUpdateGateway.emitDivisionUpdateByDivisionId).toHaveBeenCalledWith(7);
  });

  it('keeps the current name when the new one is blank', async () => {
    phaseRepository.findOne.mockResolvedValue({ id: 42, name: 'Qualifiers', division: { id: 7 } } as Phase);

    const phase = await service.update(42, { name: '   ' });

    expect(phase.name).toBe('Qualifiers');
  });
});
