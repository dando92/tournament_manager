import type { SequencedLiveEventEnvelope } from '@tournament-manager/live-messaging';
import { TournamentRealtimeRegistry } from '@realtime/state/tournament-realtime-registry';
import { TournamentRealtimeState } from '@realtime/state/tournament-realtime-state';

describe('TournamentRealtimeState', () => {
  it('owns local sequencing without mutating the subscribed envelope', () => {
    const state = new TournamentRealtimeState(7);
    const event: SequencedLiveEventEnvelope = {
      type: 'ui.tournament-changed',
      tournamentId: 7,
      payload: { tournamentId: 7 },
    };

    const first = state.apply(event);
    const second = state.apply({ ...event, type: 'ui.division-changed' });

    expect(event.sequence).toBeUndefined();
    expect(first.every(({ message }) => message.sequence === 1)).toBe(true);
    expect(second.every(({ message }) => message.sequence === 2)).toBe(true);
    expect(state.snapshot('/uiupdatehub').sequence).toBe(2);
  });

  it('uses the latest prepared message for the same snapshot identity', () => {
    const state = new TournamentRealtimeState(7);
    state.apply(matchChanged(3, 10));
    state.apply(matchChanged(3, 11));

    expect(state.snapshot('/uiupdatehub')).toEqual({
      sequence: 11,
      messages: [{
        event: 'MatchUpdate',
        data: expect.objectContaining({ matchId: 3, version: 11 }),
        sequence: 11,
      }],
    });
    expect(state.snapshot('/lobbygateway').messages).toEqual([]);
  });

  it('owns live-match transitions and reuses the selected song during progress updates', () => {
    const state = new TournamentRealtimeState(7);
    state.apply(songSelected());

    const routed = state.apply({
      type: 'syncstart.match-update',
      tournamentId: 7,
      payload: {
        tournamentId: 7,
        lobbyId: 'lobby-1',
        lobbyName: 'Lobby',
        lobbyCode: 'CODE',
        players: [{ playerId: 'player-1', score: 100 }],
      },
    });

    expect(routed.find(({ path }) => path === '/livematchgateway')?.message.data).toEqual(
      expect.objectContaining({ songTitle: 'Song', songPath: '/song' }),
    );
  });

  it('removes all cached state owned by a disconnected inactive lobby', () => {
    const state = new TournamentRealtimeState(7);
    state.apply(songSelected());
    state.apply({
      type: 'syncstart.lobby-disconnected',
      tournamentId: 7,
      payload: { tournamentId: 7, lobbyId: 'lobby-1', isActive: false },
    });

    expect(state.snapshot('/lobbygateway').messages).toEqual([]);
    expect(state.snapshot('/livematchgateway').messages).toEqual([]);

    const progress = state.apply({
      type: 'syncstart.match-update',
      tournamentId: 7,
      payload: {
        tournamentId: 7,
        lobbyId: 'lobby-1',
        lobbyName: 'Lobby',
        lobbyCode: 'CODE',
        players: [],
      },
    });
    expect(progress.find(({ path }) => path === '/livematchgateway')?.message.data).toEqual(
      expect.objectContaining({ songTitle: '', songPath: '' }),
    );
  });

  it('rejects events belonging to another tournament', () => {
    const state = new TournamentRealtimeState(7);
    expect(() => state.apply({ type: 'ui.warning', tournamentId: 8, payload: {} }))
      .toThrow('Cannot apply tournament 8 event to tournament 7 state');
  });
});

describe('TournamentRealtimeRegistry', () => {
  it('keeps tournament projections independent and returns an empty snapshot before intake', () => {
    const registry = new TournamentRealtimeRegistry();
    expect(registry.snapshot(7, '/uiupdatehub')).toEqual({ sequence: 0, messages: [] });

    registry.getOrCreate(7).apply(matchChanged(3, 1));

    expect(registry.getOrCreate(7)).toBe(registry.getOrCreate(7));
    expect(registry.snapshot(7, '/uiupdatehub').messages).toHaveLength(1);
    expect(registry.snapshot(8, '/uiupdatehub')).toEqual({ sequence: 0, messages: [] });
  });

  it('produces convergent projections on independent replicas', () => {
    const firstReplica = new TournamentRealtimeRegistry();
    const secondReplica = new TournamentRealtimeRegistry();
    const events = [songSelected(), matchChanged(3, undefined)];

    for (const event of events) {
      firstReplica.getOrCreate(7).apply(event);
      secondReplica.getOrCreate(7).apply(event);
    }

    expect(firstReplica.snapshot(7, '/uiupdatehub'))
      .toEqual(secondReplica.snapshot(7, '/uiupdatehub'));
    expect(firstReplica.snapshot(7, '/livematchgateway'))
      .toEqual(secondReplica.snapshot(7, '/livematchgateway'));
  });
});

function matchChanged(matchId: number, sequence?: number): SequencedLiveEventEnvelope {
  return {
    type: 'ui.match-changed',
    tournamentId: 7,
    sequence,
    payload: { tournamentId: 7, matchId, version: sequence },
  };
}

function songSelected(): SequencedLiveEventEnvelope {
  return {
    type: 'syncstart.song-selected',
    tournamentId: 7,
    payload: {
      tournamentId: 7,
      lobbyId: 'lobby-1',
      lobbyName: 'Lobby',
      lobbyCode: 'CODE',
      song: { title: 'Song', songPath: '/song', artist: 'Artist', songLength: 100 },
    },
  };
}
