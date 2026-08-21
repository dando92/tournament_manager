import { entrantPlayers } from "@/features/entrant/types/Entrant";
import { Match, MatchCommitState } from "@/features/match/types/Match";
import type { Status } from "@/shared/components/ui/status";

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

/**
 * The status glyph a commit state is drawn with.
 *
 * The badge around it stays neutral: colour lives in the glyph alone, so a list
 * of matches never turns into a row of coloured pills.
 */
export function getCommitStatus(state: MatchCommitState): Status {
  return { Disabled: "idle", Pending: "pending", Completed: "done" }[state] as Status;
}

/** Neutral badge shell. The glyph inside it carries the state. */
export const commitBadgeClass =
  "inline-flex items-center gap-1.5 rounded-full border border-ui-border bg-ui-raised py-0.5 pl-1.5 pr-2.5 text-[11px] font-medium text-ui-text-soft";

export function getActiveLabel(active: boolean): string {
  return active ? "Match active" : "Match not active";
}
