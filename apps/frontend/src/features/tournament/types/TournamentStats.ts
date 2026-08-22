/**
 * The tournament graph as `GET /divisions?tournamentId=` still sends it: raw
 * entities, divisions through scores, four levels deep.
 *
 * It is declared here and not in `@tournament-manager/contracts` because it is
 * not a projection anybody chose — it is whatever the entity relations happen
 * to carry. Phase 5 of the API refactoring replaces the endpoint with a
 * standings query and this type goes with it. Until then the statistics page
 * is the only consumer, and this states exactly the fields it reads.
 */

export type TournamentStatsScore = {
  percentage: number;
  isFailed: boolean;
};

export type TournamentStatsStanding = {
  id: number;
  points: number;
  player: { id: number; playerName: string };
  score: TournamentStatsScore | null;
};

export type TournamentStatsRound = {
  id: number;
  song: { title: string; artist?: string } | null;
  standings?: TournamentStatsStanding[];
};

export type TournamentStatsMatch = {
  id: number;
  name: string;
  rounds?: TournamentStatsRound[];
};

export type TournamentStatsPhase = {
  name: string;
  matches?: TournamentStatsMatch[];
};

export type TournamentStatsDivision = {
  name: string;
  phases?: TournamentStatsPhase[];
};
