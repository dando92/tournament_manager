export interface EventEnvelope<TPayload = unknown> {
  id: string;
  type: string;
  version: number;
  aggregateId: string;
  occurredAt: string;
  correlationId: string;
  causationId: string | null;
  payload: TPayload;
}

export interface TournamentCreatedV1Payload {
  tournamentId: number;
  name: string;
}

export type TournamentCreatedV1 = EventEnvelope<TournamentCreatedV1Payload> & {
  type: 'tournament.created';
  version: 1;
};

export interface SyncStartSongCompletedV1Payload {
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

export type SyncStartSongCompletedV1 =
  EventEnvelope<SyncStartSongCompletedV1Payload> & {
    type: 'syncstart.song-completed';
    version: 1;
  };

export interface LiveEventEnvelope<TPayload = unknown> {
  type: string;
  version: number;
  tournamentId: number;
  occurredAt: string;
  payload: TPayload;
}

export function isEventEnvelope(value: unknown): value is EventEnvelope {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.id === 'string' &&
    typeof event.type === 'string' &&
    typeof event.version === 'number' &&
    typeof event.aggregateId === 'string' &&
    typeof event.occurredAt === 'string' &&
    typeof event.correlationId === 'string' &&
    (event.causationId === null || typeof event.causationId === 'string') &&
    Object.prototype.hasOwnProperty.call(event, 'payload')
  );
}

export function isTournamentCreatedV1(
  event: EventEnvelope,
): event is TournamentCreatedV1 {
  if (event.type !== 'tournament.created' || event.version !== 1) return false;
  if (!event.payload || typeof event.payload !== 'object') return false;
  const payload = event.payload as Record<string, unknown>;
  return (
    Number.isInteger(payload.tournamentId) && typeof payload.name === 'string'
  );
}

export function isSyncStartSongCompletedV1(
  event: EventEnvelope,
): event is SyncStartSongCompletedV1 {
  if (event.type !== 'syncstart.song-completed' || event.version !== 1)
    return false;
  if (!event.payload || typeof event.payload !== 'object') return false;
  const payload = event.payload as Record<string, unknown>;
  const song = payload.song as Record<string, unknown> | undefined;
  const scores = payload.scores;
  return (
    Number.isInteger(payload.tournamentId) &&
    typeof payload.lobbyId === 'string' &&
    typeof payload.lobbyName === 'string' &&
    typeof payload.lobbyCode === 'string' &&
    Boolean(song) &&
    typeof song.songPath === 'string' &&
    typeof song.title === 'string' &&
    typeof song.artist === 'string' &&
    typeof song.songLength === 'number' &&
    Array.isArray(scores) &&
    scores.every(isCompletedScore)
  );
}

function isCompletedScore(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const score = value as Record<string, unknown>;
  return (
    typeof score.playerId === 'string' &&
    typeof score.playerName === 'string' &&
    typeof score.score === 'number' &&
    (score.exScore === undefined || typeof score.exScore === 'number') &&
    typeof score.isFailed === 'boolean'
  );
}
