export interface Tournament {
  id: number;
  name: string;
  syncstartUrl?: string;
  availableSetupsCount: number;
  defaultScoringSystem: string;
}

export interface TournamentConfiguration {
  id: number;
  name: string;
  syncstartUrl: string;
  startggApiKey: string | null;
  availableSetupsCount: number;
  defaultScoringSystem: string;
}
