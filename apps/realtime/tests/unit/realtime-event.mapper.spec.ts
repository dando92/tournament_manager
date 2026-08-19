import type { SequencedLiveEventEnvelope } from '@tournament-manager/live-messaging';
import { mapRealtimeEvent } from '@realtime/live-events/realtime-event.mapper';

describe('mapRealtimeEvent', () => {
  const update: SequencedLiveEventEnvelope & { sequence: number } = {
    type: 'ui.match-changed',
    tournamentId: 7,
    sequence: 12,
    payload: { tournamentId: 7, divisionId: 3, phaseId: 4, phaseGroupId: 5, matchId: 6 },
  };

  it('maps prepared UI events and preserves their scoped sequence', () => {
    expect(mapRealtimeEvent(update, '/uiupdatehub')).toEqual({
      event: 'MatchUpdate',
      data: update.payload,
      sequence: 12,
    });
  });

  it('advances unrelated gateway sequences without leaking event data', () => {
    expect(mapRealtimeEvent(update, '/lobbygateway')).toEqual({
      event: 'RealtimeSequence',
      data: { tournamentId: 7 },
      sequence: 12,
    });
  });

  it('maps SyncStart telemetry without domain calculations', () => {
    const selected: SequencedLiveEventEnvelope & { sequence: number } = {
      type: 'syncstart.song-selected',
      tournamentId: 7,
      sequence: 13,
      payload: {
        tournamentId: 7,
        lobbyId: 'lobby-1',
        lobbyName: 'Lobby',
        lobbyCode: 'CODE',
        song: { title: 'Song', songPath: '/song', artist: 'Artist', songLength: 100 },
      },
    };
    expect(mapRealtimeEvent(selected, '/livematchgateway')).toMatchObject({
      event: 'OnSongSelected',
      sequence: 13,
      data: { tournamentId: 7, lobbyId: 'lobby-1', songTitle: 'Song', players: [] },
    });
  });
});
