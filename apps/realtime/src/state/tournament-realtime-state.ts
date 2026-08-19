import type { SequencedLiveEventEnvelope } from '@tournament-manager/live-messaging';
import {
  mapRealtimeEvent,
  type LiveMatchState,
} from '../live-events/realtime-event.mapper';
import {
  REALTIME_PATHS,
  type RealtimeMessage,
  type RealtimePath,
  type RealtimeSnapshot,
} from '../realtime-message';

export type RoutedRealtimeMessage = {
  path: RealtimePath;
  message: RealtimeMessage;
};

/** Owns the replaceable, replica-local realtime projection for one tournament. */
export class TournamentRealtimeState {
  private readonly snapshots = new Map<RealtimePath, Map<string, RealtimeMessage>>();
  private readonly liveMatches = new Map<string, LiveMatchState>();
  private lastSequence = 0;

  constructor(readonly tournamentId: number) {}

  apply(event: SequencedLiveEventEnvelope): RoutedRealtimeMessage[] {
    if (event.tournamentId !== this.tournamentId) {
      throw new Error(`Cannot apply tournament ${event.tournamentId} event to tournament ${this.tournamentId} state`);
    }

    const sequence = event.sequence ?? this.lastSequence + 1;
    this.lastSequence = sequence;
    const sequencedEvent = { ...event, sequence };
    const lobbyId = lobbyIdOf(event);

    if (event.type === 'syncstart.lobby-disconnected' && lobbyId && !isActiveLobby(event)) {
      this.removeLobby(lobbyId);
    }

    return REALTIME_PATHS.map((path) => {
      const message = mapRealtimeEvent(
        sequencedEvent,
        path,
        lobbyId ? this.liveMatches.get(lobbyId) : undefined,
      );
      this.cache(path, message);
      if (path === '/livematchgateway' && lobbyId && message.event !== 'RealtimeSequence') {
        this.liveMatches.set(lobbyId, message.data as LiveMatchState);
      }
      return { path, message };
    });
  }

  snapshot(path: RealtimePath): RealtimeSnapshot {
    return {
      sequence: this.lastSequence,
      messages: Array.from(this.snapshots.get(path)?.values() ?? []),
    };
  }

  private cache(path: RealtimePath, message: RealtimeMessage): void {
    if (message.event === 'RealtimeSequence') return;
    const messages = this.snapshots.get(path) ?? new Map<string, RealtimeMessage>();
    messages.set(messageIdentity(message), message);
    this.snapshots.set(path, messages);
  }

  private removeLobby(lobbyId: string): void {
    this.liveMatches.delete(lobbyId);
    for (const messages of this.snapshots.values()) {
      for (const [key, message] of messages) {
        if ((message.data as { lobbyId?: string } | undefined)?.lobbyId === lobbyId) {
          messages.delete(key);
        }
      }
    }
  }
}

function lobbyIdOf(event: SequencedLiveEventEnvelope): string | undefined {
  return (event.payload as { lobbyId?: string } | undefined)?.lobbyId;
}

function isActiveLobby(event: SequencedLiveEventEnvelope): boolean {
  return Boolean((event.payload as { isActive?: boolean } | undefined)?.isActive);
}

function messageIdentity(message: RealtimeMessage): string {
  const data = message.data as { lobbyId?: string; playerId?: string; matchId?: number } | undefined;
  if (data?.playerId) return `${message.event}:lobby:${data.lobbyId}:player:${data.playerId}`;
  if (data?.matchId) return `${message.event}:match:${data.matchId}`;
  return data?.lobbyId ? `${message.event}:lobby:${data.lobbyId}` : message.event;
}
