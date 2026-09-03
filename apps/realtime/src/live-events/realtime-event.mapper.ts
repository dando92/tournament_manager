import type {
  LobbyConnectionDto,
  LobbyMatchUpdateDto,
  LobbyPlayerReadyDto,
  LobbySongCompletedDto,
  LobbySongSelectedDto,
  LiveMatchStateDto,
  SyncStartConnectionStatusDto,
} from '@tournament-manager/contracts';
import type { SequencedLiveEventEnvelope } from '@tournament-manager/live-messaging';
import type { RealtimeMessage, RealtimePath } from '../realtime-message';

export type LiveMatchState = LiveMatchStateDto;

export function mapRealtimeEvent(
  source: SequencedLiveEventEnvelope & { sequence: number },
  path: RealtimePath,
  previousLiveMatch?: LiveMatchState,
): RealtimeMessage {
  const sequenceOnly = (): RealtimeMessage => ({
    event: 'RealtimeSequence',
    data: { tournamentId: source.tournamentId },
    sequence: source.sequence,
  });

  if (path === '/uiupdatehub') {
    if (source.type === 'ui.match-changed')
      return message('MatchUpdate', source.payload, source.sequence);
    if (source.type === 'ui.warning')
      return message('UiWarning', { tournamentId: source.tournamentId, ...(source.payload as object) }, source.sequence);
    if (source.type === 'tournament.snapshot-changed')
      return message('TournamentUpdate', { tournamentId: source.tournamentId }, source.sequence);
    const eventName = uiEventName(source.type);
    if (eventName) return message(eventName, source.payload, source.sequence);
    return sequenceOnly();
  }

  if (path === '/lobbygateway') {
    if (source.type === 'syncstart.connection-status')
      return message('OnSyncStartConnectionStatus', source.payload as SyncStartConnectionStatusDto, source.sequence);
    if (source.type === 'syncstart.lobby-active')
      return message('OnConnectionActive', source.payload as LobbyConnectionDto, source.sequence);
    if (source.type === 'syncstart.lobby-connected')
      return message('OnConnected', source.payload as LobbyConnectionDto, source.sequence);
    if (source.type === 'syncstart.song-selected') {
      const event = source.payload as LobbySongSelectedDto;
      return message('OnSongSelected', {
        tournamentId: event.tournamentId,
        lobbyId: event.lobbyId,
        lobbyName: event.lobbyName,
        lobbyCode: event.lobbyCode,
        songTitle: event.song.title,
        songPath: event.song.songPath,
      }, source.sequence);
    }
    if (source.type === 'syncstart.player-ready')
      return message('OnPlayerReady', source.payload as LobbyPlayerReadyDto, source.sequence);
    return sequenceOnly();
  }

  if (source.type === 'syncstart.song-selected') {
    const event = source.payload as LobbySongSelectedDto;
    return message('OnSongSelected', {
      tournamentId: event.tournamentId,
      lobbyId: event.lobbyId,
      lobbyName: event.lobbyName,
      lobbyCode: event.lobbyCode,
      songTitle: event.song.title,
      songPath: event.song.songPath,
      players: [],
    }, source.sequence);
  }
  if (source.type === 'syncstart.match-update') {
    const event = source.payload as LobbyMatchUpdateDto;
    return message('OnMatchUpdate', {
      tournamentId: event.tournamentId,
      lobbyId: event.lobbyId,
      lobbyName: event.lobbyName,
      lobbyCode: event.lobbyCode,
      songTitle: event.song?.title ?? previousLiveMatch?.songTitle ?? '',
      songPath: event.song?.songPath ?? previousLiveMatch?.songPath ?? '',
      players: event.players,
    }, source.sequence);
  }
  if (source.type === 'syncstart.song-completed-live') {
    const event = source.payload as LobbySongCompletedDto;
    return message('OnSongCompleted', {
      tournamentId: event.tournamentId,
      lobbyId: event.lobbyId,
      lobbyName: event.lobbyName,
      lobbyCode: event.lobbyCode,
      songTitle: event.song.title,
      songPath: event.song.songPath,
      players: event.scores.map((score) => ({ ...score, isCompleted: true })),
    }, source.sequence);
  }
  return sequenceOnly();
}

function message(event: string, data: unknown, sequence: number): RealtimeMessage {
  return { event, data, sequence };
}

function uiEventName(type: string): string | undefined {
  const names: Record<string, string> = {
    'ui.tournament-changed': 'TournamentUpdate',
    'ui.songs-changed': 'SongsUpdate',
    'ui.division-changed': 'DivisionUpdate',
    'ui.phase-changed': 'PhaseUpdate',
    'ui.phase-group-changed': 'PhaseGroupUpdate',
    'ui.schedule-changed': 'ScheduleUpdate',
  };
  return names[type];
}
