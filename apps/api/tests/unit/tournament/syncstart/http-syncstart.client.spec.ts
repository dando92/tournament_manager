import { BadGatewayException } from '@nestjs/common';
import { of } from 'rxjs';
import { HttpSyncStartClient } from '@tournament/syncstart/http-syncstart.client';

describe('HttpSyncStartClient', () => {
  const http = { request: jest.fn() };
  const config = {
    get: jest.fn((key: string) =>
      key === 'INTERNAL_HTTP_TIMEOUT_MS' ? '2500' : undefined,
    ),
    getOrThrow: jest.fn((key: string) =>
      key === 'SYNCSTART_INTERNAL_URL' ? 'http://syncstart:3002' : 'secret',
    ),
  };
  let client: HttpSyncStartClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new HttpSyncStartClient(http as never, config as never);
  });

  it('configures a tournament through the authenticated internal endpoint', async () => {
    http.request.mockReturnValue(of({ status: 200, data: undefined }));

    await client.configureTournament({
      tournamentId: 7,
      syncstartUrl: 'ws://server',
    });

    expect(http.request).toHaveBeenCalledWith({
      method: 'PUT',
      url: 'http://syncstart:3002/internal/tournaments/7/configuration',
      data: { syncstartUrl: 'ws://server' },
      timeout: 2500,
      headers: {
        'content-type': 'application/json',
        'x-internal-service-token': 'secret',
      },
    });
  });

  it('returns the typed lobby snapshot', async () => {
    const snapshot = {
      status: { isActive: true, isConnected: true },
      lobbies: [],
    };
    http.request.mockReturnValue(of({ status: 200, data: snapshot }));

    await expect(client.listLobbies(7)).resolves.toEqual(snapshot);
  });

  it('encodes a lobby id in the disconnect route', async () => {
    http.request.mockReturnValue(of({ status: 204, data: undefined }));

    await client.disconnectLobby(7, 'lobby/one');

    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'DELETE',
        url: 'http://syncstart:3002/internal/tournaments/7/lobbies/lobby%2Fone',
      }),
    );
  });

  it('sends song commands to the encoded lobby route', async () => {
    http.request.mockReturnValue(of({ status: 204, data: undefined }));

    await client.selectSong({ tournamentId: 7, lobbyId: 'lobby/one', songPath: 'Pack/Song' });
    await client.startSong({ tournamentId: 7, lobbyId: 'lobby/one', songPath: 'Pack/Song' });

    expect(http.request).toHaveBeenNthCalledWith(1, expect.objectContaining({
      method: 'POST',
      url: 'http://syncstart:3002/internal/tournaments/7/lobbies/lobby%2Fone/select-song',
      data: { songPath: 'Pack/Song' },
    }));
    expect(http.request).toHaveBeenNthCalledWith(2, expect.objectContaining({
      method: 'POST',
      url: 'http://syncstart:3002/internal/tournaments/7/lobbies/lobby%2Fone/start',
      data: { songPath: 'Pack/Song' },
    }));
  });

  it('maps unsuccessful responses to a gateway error', async () => {
    http.request.mockReturnValue(of({ status: 503, data: undefined }));

    await expect(client.connectServer(7)).rejects.toThrow(BadGatewayException);
    await expect(client.connectServer(7)).rejects.toThrow(
      'SyncStart request failed: HTTP 503',
    );
  });
});

