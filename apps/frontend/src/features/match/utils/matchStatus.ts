import { entrantPlayers } from "@/features/entrant/types/Entrant";
import { Match, MatchCommitState } from "@/features/match/types/Match";
import type { Status } from "@/shared/components/ui/status";

export type ManualPointsByPlayerId = Record<number, number>;

export function hasAllSongStandings(match: Match): boolean {
  const players = entrantPlayers(match.entrants);
  if (players.length === 0 || match.rounds.length === 0) return false;

  return match.rounds.every((round) =>
    players.every((player) => (round.standings ?? []).some((standing) => standing.score.player.id === player.id)),
  );
}

function hasAnySongStanding(match: Match): boolean {
  return match.rounds.some((round) => (round.standings ?? []).length > 0);
}

/**
 * How far a match is from having a final result.
 *
 * Four steps rather than three, because "nothing in it yet" and "being played"
 * are not the same thing to anyone running a tournament — and the difference is
 * what tells you which of two unfinished matches to walk over to.
 *
 * They map onto the status ring in order, so the glyph fills as the match moves
 * forward and the list still reads in greyscale. See .ai/Design.md.
 */
export type MatchProgress = "empty" | "started" | "readyToCommit" | "completed";

const PROGRESS_STATUS: Record<MatchProgress, Status> = {
  empty: "idle",
  started: "running",
  readyToCommit: "pending",
  completed: "done",
};

const PROGRESS_LABEL: Record<MatchProgress, string> = {
  empty: "Empty",
  started: "In progress",
  readyToCommit: "Ready to commit",
  completed: "Completed",
};

/**
 * `manualPoints` are the card's own draft, held in component state until a
 * commit persists them, so a list that only has the match cannot see them.
 * Omitting them simply means the draft does not count toward progress.
 */
export function getMatchProgress(match: Match, manualPoints: ManualPointsByPlayerId = {}): MatchProgress {
  if (match.matchResult) return "completed";

  if (match.rounds.length > 0) {
    if (hasAllSongStandings(match)) return "readyToCommit";
    return "started";
  }

  const players = entrantPlayers(match.entrants);
  if (players.some((player) => (manualPoints[player.id] ?? 0) > 0)) return "readyToCommit";

  return hasAnySongStanding(match) ? "started" : "empty";
}

export function getMatchProgressStatus(progress: MatchProgress): Status {
  return PROGRESS_STATUS[progress];
}

export function getMatchProgressLabel(progress: MatchProgress): string {
  return PROGRESS_LABEL[progress];
}

/**
 * Whether the commit button can fire.
 *
 * Derived from the progress above rather than computed again, so the badge a
 * viewer reads and the button they press can never disagree.
 */
export function getMatchCommitState(match: Match, manualPoints: ManualPointsByPlayerId = {}): MatchCommitState {
  const progress = getMatchProgress(match, manualPoints);
  if (progress === "completed") return "Completed";
  return progress === "readyToCommit" ? "Pending" : "Disabled";
}

export function getActiveLabel(active: boolean): string {
  return active ? "Match active" : "Match not active";
}

/** Neutral badge shell. The glyph inside it carries the state. */
export const commitBadgeClass =
  "inline-flex items-center gap-1.5 rounded-full border border-ui-border bg-ui-raised py-0.5 pl-1.5 pr-2.5 text-[11px] font-medium text-ui-text-soft";
