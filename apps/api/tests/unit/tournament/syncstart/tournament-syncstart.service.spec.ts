import { TournamentSyncStartService } from '@tournament/syncstart/tournament-syncstart.service';

describe('TournamentSyncStartService', () => {
  const client = {
    configureTournament: jest.fn(),
    closeTournament: jest.fn(),
    connectServer: jest.fn(),
    disconnectServer: jest.fn(),
    listLobbies: jest.fn(),
    connectLobby: jest.fn(),
    createLobby: jest.fn(),
    disconnectLobby: jest.fn(),
  };
  let service: TournamentSyncStartService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TournamentSyncStartService(client);
  });

  it('delegates tournament configuration to the abstract client', async () => {
    client.configureTournament.mockResolvedValue(undefined);

    await service.configureTournament(7, 'ws://server');

    expect(client.configureTournament).toHaveBeenCalledWith({
      tournamentId: 7,
      syncstartUrl: 'ws://server',
    });
  });

  it('defaults optional lobby connection input at the application boundary', async () => {
    client.connectLobby.mockResolvedValue({ id: 'lobby-id' });

    await expect(service.connectLobby(7, undefined, 'ab/cd')).resolves.toBe(
      'lobby-id',
    );
    expect(client.connectLobby).toHaveBeenCalledWith({
      tournamentId: 7,
      lobbyName: 'ab/cd',
      lobbyCode: 'ab/cd',
      password: '',
    });
  });

  it('delegates lobby creation with normalized optional values', async () => {
    const created = { lobbyId: 'lobby-id', lobbyCode: 'ABCD' };
    client.createLobby.mockResolvedValue(created);

    await expect(service.createLobby(7)).resolves.toEqual(created);
    expect(client.createLobby).toHaveBeenCalledWith({
      tournamentId: 7,
      lobbyName: '',
      password: '',
    });
  });
});

