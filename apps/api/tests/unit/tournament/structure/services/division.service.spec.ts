import { Entrant } from '@tournament-manager/persistence';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';
import { DivisionService } from '@tournament/structure/services/division.service';

describe('DivisionService seeding', () => {
  const divisionRepository = {
    findOne: jest.fn(),
  };
  const entrantRepository = {
    save: jest.fn(),
  };
  const uiUpdateGateway = {
    emitDivisionUpdateByDivisionId: jest.fn(),
  };

  const service = new DivisionService(
    divisionRepository as never,
    {} as never,
    entrantRepository as never,
    uiUpdateGateway as unknown as UiUpdatePublisher,
  );

  function entrant(id: number, name: string, seedNum: number | null = null): Entrant {
    return { id, name, seedNum, status: 'active' } as Entrant;
  }

  beforeEach(() => {
    jest.resetAllMocks();
    entrantRepository.save.mockImplementation(async (value: Entrant) => value);
  });

  it('numbers the entrants in the order they are given', async () => {
    const entrants = [entrant(1, 'Ann'), entrant(2, 'Bob'), entrant(3, 'Cal')];
    divisionRepository.findOne.mockResolvedValue({ id: 4, entrants });

    await service.updateSeeding(4, [3, 1, 2]);

    expect(entrants.map((value) => value.seedNum)).toEqual([2, 3, 1]);
    expect(uiUpdateGateway.emitDivisionUpdateByDivisionId).toHaveBeenCalledWith(4);
  });

  it('lists the entrants by seed, with the unseeded ones last', async () => {
    divisionRepository.findOne.mockResolvedValue({
      id: 4,
      entrants: [entrant(1, 'Ann'), entrant(2, 'Bob', 2), entrant(3, 'Cal', 1)],
    });

    const entrants = await service.getEntrants(4);

    expect(entrants.map((value) => value.name)).toEqual(['Cal', 'Bob', 'Ann']);
  });

  it('refuses an entrant that belongs to another division', async () => {
    divisionRepository.findOne.mockResolvedValue({ id: 4, entrants: [entrant(1, 'Ann')] });

    await expect(service.updateSeeding(4, [99])).rejects.toThrow('Entrant 99 does not belong to division 4');
  });
});
