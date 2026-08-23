import { Division, Phase } from '@tournament-manager/persistence';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';
import { PhaseGroupCommands } from '@tournament/structure/phase-group/phase-group.commands';
import { PhaseService } from '@tournament/structure/services/phase.service';

describe('PhaseService', () => {
  const phaseRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
  };
  const divisionRepository = {
    findOne: jest.fn(),
  };
  const phaseGroupCommands = {
    create: jest.fn(),
  };
  const publisher = {
    emitDivisionUpdate: jest.fn(),
  };

  const service = new PhaseService(
    phaseRepository as never,
    divisionRepository as never,
    phaseGroupCommands as unknown as PhaseGroupCommands,
    publisher as unknown as UiUpdatePublisher,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    divisionRepository.findOne.mockResolvedValue({ id: 7, tournament: { id: 2 } } as Division);
    phaseRepository.save.mockImplementation(async (phase: Phase) => ({ ...phase, id: 42 }));
  });

  it('gives a newly created phase a default phase group', async () => {
    const phase = await service.createWithDefaultPhaseGroup({ divisionId: 7, name: 'Qualifiers' });

    expect(phase.id).toBe(42);
    expect(phaseGroupCommands.create).toHaveBeenCalledTimes(1);
    expect(phaseGroupCommands.create).toHaveBeenCalledWith(42, {});
  });

  it('leaves the plain create without a phase group so importers own their own structure', async () => {
    await service.create({ divisionId: 7, name: 'Qualifiers' });

    expect(phaseGroupCommands.create).not.toHaveBeenCalled();
  });

  it('renames a phase and tells its division to refresh', async () => {
    phaseRepository.findOne.mockResolvedValue({ id: 42, name: 'Qualifiers', division: { id: 7, tournament: { id: 2 } } } as Phase);

    const phase = await service.update(42, { name: '  Finals  ' });

    expect(phase.name).toBe('Finals');
    /* The address comes from the phase the write loaded, so nothing has to look
       up which tournament the event belongs to. */
    expect(publisher.emitDivisionUpdate).toHaveBeenCalledWith({ tournamentId: 2, divisionId: 7 });
  });

  it('keeps the current name when the new one is blank', async () => {
    phaseRepository.findOne.mockResolvedValue({ id: 42, name: 'Qualifiers', division: { id: 7, tournament: { id: 2 } } } as Phase);

    const phase = await service.update(42, { name: '   ' });

    expect(phase.name).toBe('Qualifiers');
  });
});
