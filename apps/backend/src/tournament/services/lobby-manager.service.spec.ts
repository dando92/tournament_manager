import { Repository } from 'typeorm';

import { Tournament } from '@persistence/entities';
import { SyncStartConnector } from '@syncstart/index';
import { LiveMatchGateway } from '../gateways/live-match.gateway';
import { LobbyGateway } from '../gateways/lobby.gateway';
import { SyncStartDurableEventPublisher } from '../standing/syncstart-durable-event.publisher';

import { LobbyManager } from './lobby-manager.service';

type ConnectorDouble = Pick<
  SyncStartConnector,
  | 'SpectateLobby'
  | 'CreateLobby'
  | 'LeaveLobby'
  | 'SearchLobbies'
  | 'IsActive'
  | 'IsConnected'
  | 'ConnectToServer'
  | 'DisconnectFromServer'
  | 'DisconnectAll'
>;

function connectorDouble(): jest.Mocked<ConnectorDouble> {
  return {
    SpectateLobby: jest.fn(),
    CreateLobby: jest.fn(),
    LeaveLobby: jest.fn(),
    SearchLobbies: jest.fn().mockResolvedValue([]),
    IsActive: jest.fn().mockReturnValue(true),
    IsConnected: jest.fn().mockReturnValue(true),
    ConnectToServer: jest.fn(),
    DisconnectFromServer: jest.fn(),
    DisconnectAll: jest.fn(),
  };
}

function setConnector(manager: LobbyManager, tournamentId: number, connector: ConnectorDouble): void {
  const state = manager as unknown as { connectors: Map<number, SyncStartConnector> };
  state.connectors.set(tournamentId, connector as SyncStartConnector);
}

describe('LobbyManager', () => {
  const tournamentRepository = {
    find: jest.fn(),
  };
  const lobbyGateway = {
    OnDisconnection: jest.fn(),
  };
  const manager = new LobbyManager(
    tournamentRepository as unknown as Repository<Tournament>,
    {} as SyncStartDurableEventPublisher,
    lobbyGateway as unknown as LobbyGateway,
    {} as LiveMatchGateway,
  );

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    const state = manager as unknown as {
      connectors: Map<number, SyncStartConnector>;
      lobbyCodeMeta: Map<string, unknown>;
    };
    state.connectors.clear();
    state.lobbyCodeMeta.clear();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('loads one inactive connector for each configured tournament', async () => {
    tournamentRepository.find.mockResolvedValue([
      { id: 1, syncstartUrl: 'ws://syncstart-one.test' },
      { id: 2, syncstartUrl: '' },
    ]);

    await manager.onModuleInit();

    await expect(manager.GetLobbies(1)).resolves.toEqual({
      status: { isActive: false, isConnected: false },
      lobbies: [],
    });
    await expect(manager.ConnectSyncStartServer(2)).rejects.toThrow(
      'No SyncStart connector for tournament=2',
    );
  });

  it('normalizes a lobby code and merges tracked metadata with search results', async () => {
    const connector = connectorDouble();
    connector.SpectateLobby.mockResolvedValue({ lobbyId: 'ABCD', lobbyCode: 'ABCD' });
    connector.SearchLobbies.mockResolvedValue([
      {
        code: 'abcd',
        isPasswordProtected: true,
        playerCount: 2,
        spectatorCount: 1,
      },
    ]);
    setConnector(manager, 1, connector);

    await expect(manager.ConnectLobby(1, 'Finals', 'abcd', 'secret')).resolves.toBe('ABCD');
    await expect(manager.GetLobbies(1)).resolves.toEqual({
      status: { isActive: true, isConnected: true },
      lobbies: [
        {
          id: 'ABCD',
          name: 'Finals',
          lobbyCode: 'ABCD',
          isPasswordProtected: true,
          playerCount: 2,
          spectatorCount: 1,
        },
      ],
    });
    expect(connector.SpectateLobby).toHaveBeenCalledWith({
      tournamentId: 1,
      lobbyName: 'Finals',
      lobbyCode: 'ABCD',
      password: 'secret',
    });
  });

  it('removes failed connection state and emits a disconnected lobby event', async () => {
    const connector = connectorDouble();
    connector.SpectateLobby.mockRejectedValue(new Error('Connection refused'));
    setConnector(manager, 1, connector);

    await expect(manager.ConnectLobby(1, 'Finals', 'abcd', '')).rejects.toThrow('Connection refused');

    expect(lobbyGateway.OnDisconnection).toHaveBeenCalledWith({
      tournamentId: 1,
      lobbyId: 'ABCD',
      lobbyName: 'Finals',
      lobbyCode: 'ABCD',
      isActive: false,
      isConnected: false,
    });
    await expect(manager.GetLobbies(1)).resolves.toEqual({
      status: { isActive: true, isConnected: true },
      lobbies: [],
    });
  });

  it('retains reconnectable lobby metadata but removes inactive lobbies', async () => {
    const connector = connectorDouble();
    connector.IsConnected.mockReturnValue(false);
    setConnector(manager, 1, connector);
    const event = {
      tournamentId: 1,
      lobbyId: 'ABCD',
      lobbyName: 'Finals',
      lobbyCode: 'ABCD',
      isActive: true,
      isConnected: true,
    };
    manager.OnConnected(event);

    manager.OnDisconnection({ ...event, isConnected: false });
    expect((await manager.GetLobbies(1)).lobbies).toHaveLength(1);

    manager.OnDisconnection({ ...event, isActive: false, isConnected: false });
    expect((await manager.GetLobbies(1)).lobbies).toHaveLength(0);
  });

  it('disconnects the connector and removes metadata when a lobby is left', async () => {
    const connector = connectorDouble();
    setConnector(manager, 1, connector);
    manager.OnConnected({
      tournamentId: 1,
      lobbyId: 'ABCD',
      lobbyName: 'Finals',
      lobbyCode: 'ABCD',
      isActive: true,
      isConnected: true,
    });

    manager.DisconnectLobby(1, 'abcd');

    expect(connector.LeaveLobby).toHaveBeenCalledWith('ABCD');
    expect((await manager.GetLobbies(1)).lobbies).toHaveLength(0);
  });
});
