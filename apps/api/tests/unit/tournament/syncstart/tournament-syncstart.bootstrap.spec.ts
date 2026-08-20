import { TournamentSyncStartBootstrap } from '@tournament/syncstart/tournament-syncstart.bootstrap';

describe('TournamentSyncStartBootstrap', () => {
  it('configures only non-closed tournaments that have a SyncStart URL', async () => {
    const tournaments = {
      find: jest.fn().mockResolvedValue([
        { id: 1, status: 'open', syncstartUrl: 'ws://one' },
        { id: 2, status: 'closed', syncstartUrl: 'ws://two' },
        { id: 3, status: 'open', syncstartUrl: undefined },
      ]),
    };
    const syncStart = {
      configureTournament: jest.fn().mockResolvedValue(undefined),
    };
    const bootstrap = new TournamentSyncStartBootstrap(
      tournaments as never,
      syncStart as never,
    );

    await bootstrap.onModuleInit();

    expect(syncStart.configureTournament).toHaveBeenCalledTimes(1);
    expect(syncStart.configureTournament).toHaveBeenCalledWith(1, 'ws://one');
  });
});

