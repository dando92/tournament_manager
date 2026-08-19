import type { RealtimePath, RealtimeSnapshot } from '../realtime-message';

export const REALTIME_SNAPSHOT_READER = Symbol('REALTIME_SNAPSHOT_READER');

export interface RealtimeSnapshotReader {
  snapshot(tournamentId: number, path: RealtimePath): RealtimeSnapshot;
}
