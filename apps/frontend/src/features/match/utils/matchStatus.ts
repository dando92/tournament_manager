import { entrantPlayers } from "@/features/entrant/types/Entrant";
import { Match, MatchCommitState } from "@/features/match/types/Match";

export type ManualPointsByPlayerId = Record<number, number>;

export function hasAllSongStandings(match: Match): boolean {
  const players = entrantPlayers(match.entrants);
  if (players.length === 0 || match.rounds.length === 0) return false;

  return match.rounds.every((round) =>
    players.every((player) =>
      (round.standings ?? []).some((standing) => standing.score.player.id === player.id),
    ),
  );
}

export function getMatchCommitState(match: Match, manualPoints: ManualPointsByPlayerId = {}): MatchCommitState {
  if (match.matchResult) return "Completed";

  if (match.rounds.length > 0) {
    return hasAllSongStandings(match) ? "Pending" : "Disabled";
  }

  const players = entrantPlayers(match.entrants);
  return players.some((player) => (manualPoints[player.id] ?? 0) > 0) ? "Pending" : "Disabled";
}

export function getCommitBadgeLabel(state: MatchCommitState): string {
  return state === "Disabled" ? "Not ready" : state;
}

export function getCommitBadgeClass(state: MatchCommitState): string {
  return {
    Disabled: "border-gray-200 bg-gray-50 text-gray-700",
    Pending: "border-amber-200 bg-amber-50 text-amber-800",
    Completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }[state];
}

export function getActiveLabel(active: boolean): string {
  return active ? "Match active" : "Match not active";
}
