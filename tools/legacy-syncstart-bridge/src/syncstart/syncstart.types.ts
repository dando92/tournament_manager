/**
 * The subset of the SyncStart WebSocket protocol Tournament Manager consumes.
 *
 * These shapes are copied from the SyncStart server rather than imported: the
 * bridge is the other end of that wire, and a compatibility adapter that shares
 * types with the client it answers cannot be tested against the real protocol.
 */
export type SyncStartPlayerId = "P1" | "P2";

export type SyncStartScreenName =
  | "NoScreen"
  | "ScreenSelectMusic"
  | "ScreenGameplay"
  | "ScreenPlayerOptions"
  | "ScreenEvaluation"
  | "ScreenEvaluationStage";

export type SyncStartJudgments = {
  fantasticPlus: number;
  fantastics: number;
  excellents: number;
  greats: number;
  decents: number;
  wayOffs: number;
  misses: number;
  totalSteps: number;
  minesHit: number;
  totalMines: number;
  holdsHeld: number;
  totalHolds: number;
  rollsHeld: number;
  totalRolls: number;
};

export type SyncStartSongInfo = {
  songPath: string;
  title: string;
  artist: string;
  songLength: number;
};

export type SyncStartLobbyPlayer = {
  playerId: SyncStartPlayerId;
  profileName: string;
  screenName: SyncStartScreenName;
  ready: boolean;
  judgments?: SyncStartJudgments;
  score?: number;
  exScore?: number;
  isFailed?: boolean;
};

export type SyncStartLobbyState = {
  players: SyncStartLobbyPlayer[];
  spectators: string[];
  code: string;
  songInfo?: SyncStartSongInfo;
};

export type SyncStartLobbySummary = {
  code: string;
  isPasswordProtected: boolean;
  playerCount: number;
  spectatorCount: number;
};

export type SyncStartResponseStatus = {
  event: string;
  success: boolean;
  message?: string;
};

export type SyncStartOutgoingMessage =
  | { event: "lobbyState"; data: SyncStartLobbyState }
  | { event: "lobbySearched"; data: { lobbies: SyncStartLobbySummary[] } }
  | { event: "lobbyLeft"; data: { left: boolean } }
  | { event: "responseStatus"; data: SyncStartResponseStatus };

/** What the bridge exposes about its one virtual lobby to the WebSocket layer. */
export interface BridgeLobbyView {
  readonly code: string;
  readonly isPasswordProtected: boolean;
  matchesPassword(password: string): boolean;
  state(): SyncStartLobbyState;
}
