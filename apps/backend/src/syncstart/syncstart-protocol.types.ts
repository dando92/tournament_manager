export type SyncStartJudgments = {
  fantasticPlus: number;
  fantastics: number;
  excellents: number;
  greats: number;
  decents?: number;
  wayOffs?: number;
  misses: number;
  totalSteps: number;
  minesHit: number;
  totalMines: number;
  holdsHeld: number;
  totalHolds: number;
  rollsHeld: number;
  totalRolls: number;
};

export type SyncStartLobbyPlayer = {
  playerId: 'P1' | 'P2';
  profileName: string;
  screenName:
    | 'NoScreen'
    | 'ScreenSelectMusic'
    | 'ScreenGameplay'
    | 'ScreenPlayerOptions'
    | 'ScreenEvaluation'
    | 'ScreenEvaluationStage';
  ready: boolean;
  judgments?: SyncStartJudgments;
  score?: number;
  exScore?: number;
  isFailed?: boolean;
  songProgression?: {
    currentTime: number;
    totalTime: number;
  };
};

export type SyncStartLobbyStatePayload = {
  players: SyncStartLobbyPlayer[];
  spectators: string[];
  code: string;
  songInfo?: {
    songPath: string;
    title: string;
    artist: string;
    songLength: number;
  };
};
