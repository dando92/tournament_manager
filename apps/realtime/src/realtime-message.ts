export const REALTIME_PATHS = [
  '/uiupdatehub',
  '/lobbygateway',
  '/livematchgateway',
] as const;

export type RealtimePath = (typeof REALTIME_PATHS)[number];

export type RealtimeMessage = {
  event: string;
  data: unknown;
  sequence: number;
};

export type RealtimeSnapshot = {
  sequence: number;
  messages: RealtimeMessage[];
};

/**
 * The frame every connection opens with.
 *
 * It carries the cached state alongside the sequence it belongs to, so a
 * client is caught up by the act of connecting and never has to fetch the
 * same snapshot again to find out what it just missed.
 */
export type RealtimeReadyMessage = {
  event: 'RealtimeReady';
  data: { tournamentId: number; messages: RealtimeMessage[] };
  sequence: number;
};

export function isRealtimePath(path: string): path is RealtimePath {
  return REALTIME_PATHS.includes(path as RealtimePath);
}
