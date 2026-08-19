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

export function isRealtimePath(path: string): path is RealtimePath {
  return REALTIME_PATHS.includes(path as RealtimePath);
}
