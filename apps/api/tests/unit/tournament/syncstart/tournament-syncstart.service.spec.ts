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
    selectSong: jest.fn(),
    startSong: jest.fn(),
  };
  const matches = {
    activeSongsForTournament: jest.fn(),
    activeSongForTournament: jest.fn(),
  };
  let service: TournamentSyncStartService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TournamentSyncStartService(client, matches as any);
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

  it('lists every active tournament song with the available lobbies', async () => {
    client.listLobbies.mockResolvedValue({ status: { isActive: true, isConnected: true }, lobbies: [{ id: 'BRDG' }] });
    matches.activeSongsForTournament.mockResolvedValue([{ id: 12, title: 'Pack/Song' }]);

    await expect(service.controlOptions(7)).resolves.toEqual({
      lobbies: [{ id: 'BRDG' }],
      songs: [{ id: 12, title: 'Pack/Song' }],
    });
  });

  it('resolves an active song before sending lobby commands', async () => {
    matches.activeSongForTournament.mockResolvedValue({ id: 12, title: 'Pack/Song' });

    await service.selectSong(7, 'BRDG', 12);
    await service.startSong(7, 'BRDG', 12);

    expect(client.selectSong).toHaveBeenCalledWith({ tournamentId: 7, lobbyId: 'BRDG', songPath: 'Pack/Song' });
    expect(client.startSong).toHaveBeenCalledWith({ tournamentId: 7, lobbyId: 'BRDG', songPath: 'Pack/Song' });
  });

  it('rejects songs outside active tournament matches', async () => {
    matches.activeSongForTournament.mockResolvedValue(null);

    await expect(service.selectSong(7, 'BRDG', 12)).rejects.toThrow(
      'Song 12 is not assigned to an active match in tournament 7',
    );
    expect(client.selectSong).not.toHaveBeenCalled();
  });
});

