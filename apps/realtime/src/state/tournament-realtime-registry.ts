import { Injectable } from '@nestjs/common';
import type { RealtimePath, RealtimeSnapshot } from '../realtime-message';
import type { RealtimeSnapshotReader } from '../snapshots/realtime-snapshot-reader';
import { TournamentRealtimeState } from './tournament-realtime-state';

/** Creates and locates independent replica-local tournament projections. */
@Injectable()
export class TournamentRealtimeRegistry implements RealtimeSnapshotReader {
  private readonly states = new Map<number, TournamentRealtimeState>();

  getOrCreate(tournamentId: number): TournamentRealtimeState {
    const existing = this.states.get(tournamentId);
    if (existing) return existing;

    const state = new TournamentRealtimeState(tournamentId);
    this.states.set(tournamentId, state);
    return state;
  }

  snapshot(tournamentId: number, path: RealtimePath): RealtimeSnapshot {
    return this.states.get(tournamentId)?.snapshot(path) ?? { sequence: 0, messages: [] };
  }
}
