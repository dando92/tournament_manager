export interface Tournament {
  id: number;
  name: string;
  status: "open" | "closed";
  closedAt: string | null;
  syncstartUrl?: string;
  availableSetupsCount: number;
  defaultScoringSystem: string;
}

export interface TournamentConfiguration {
  id: number;
  name: string;
  status: "open" | "closed";
  closedAt: string | null;
  transportRetentionDays: number;
  syncstartUrl: string;
  startggApiKey: string | null;
  availableSetupsCount: number;
  defaultScoringSystem: string;
}
