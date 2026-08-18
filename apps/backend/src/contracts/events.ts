export interface EventEnvelope<TPayload = unknown> {
  id: string;
  type: string;
  aggregateId: string;
  payload: TPayload;
}

export interface TournamentCreatedPayload {
  tournamentId: number;
  name: string;
}

export type TournamentCreatedEvent = EventEnvelope<TournamentCreatedPayload> & {
  type: 'tournament.created';
};

export interface SyncStartSongCompletedPayload {
  tournamentId: number;
  lobbyId: string;
  lobbyName: string;
  lobbyCode: string;
  song: {
    songPath: string;
    title: string;
    artist: string;
    songLength: number;
  };
  scores: Array<{
    playerId: string;
    playerName: string;
    score: number;
    exScore?: number;
    isFailed: boolean;
  }>;
}

export type SyncStartSongCompletedEvent =
  EventEnvelope<SyncStartSongCompletedPayload> & {
    type: 'syncstart.song-completed';
  };

export interface LiveEventEnvelope<TPayload = unknown> {
  type: string;
  tournamentId: number;
  payload: TPayload;
}

export function isEventEnvelope(value: unknown): value is EventEnvelope {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.id === 'string' &&
    typeof event.type === 'string' &&
    typeof event.aggregateId === 'string' &&
    Object.prototype.hasOwnProperty.call(event, 'payload')
  );
}
