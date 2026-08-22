import { entrantPlayers } from "@/features/entrant/types/Entrant";
import { Match, MatchCommitState } from "@/features/match/types/Match";
import { Round } from "@/features/match/types/Round";
import { Player } from "@/features/player/types/Player";
import type { Status } from "@/shared/components/ui/status";

/**
 * Whether a round has everything it is waiting for.
 *
 * A round played on a song waits for every player: a missing score is a run
 * nobody has entered yet. A hand-scored round waits for nobody in particular —
 * the points are stated, and a match can legitimately end one to nothing — so
 * it is settled as soon as somebody has been given a point.
 *
 * That is the one place the two kinds differ, and it is not about where the
 * data is kept: it is that a stated result carries no obligation per player.
 */
function isRoundSettled(round: Round, players: Player[]): boolean {
  if (round.song === null) return (round.standings ?? []).some((standing) => standing.points > 0);
  return players.every((player) => (round.standings ?? []).some((standing) => standing.player.id === player.id));
}

/** Anything a person has put in and would lose by walking away. */
function roundHasContent(round: Round): boolean {
  if (round.song === null) return (round.standings ?? []).some((standing) => standing.points > 0);
  return (round.standings ?? []).length > 0;
}

/**
 * The points assigned by hand so far. Zero everywhere reads as an empty match
 * rather than as a match decided nil-nil: nothing has been stated yet.
 */
export function handScoredRoundOf(match: Match): Round | null {
  return match.rounds.find((round) => round.song === null) ?? null;
}

export function hasAllStandings(match: Match): boolean {
  const players = entrantPlayers(match.entrants);
  if (players.length === 0 || match.rounds.length === 0) return false;

  return match.rounds.every((round) => isRoundSettled(round, players));
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

export function getMatchProgress(match: Match): MatchProgress {
  if (match.matchResult) return "completed";
  if (match.rounds.length === 0) return "empty";
  if (hasAllStandings(match)) return "readyToCommit";

  return match.rounds.some(roundHasContent) ? "started" : "empty";
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
export function getMatchCommitState(match: Match): MatchCommitState {
  const progress = getMatchProgress(match);
  if (progress === "completed") return "Completed";
  return progress === "readyToCommit" ? "Pending" : "Disabled";
}

/**
 * Why the commit button cannot fire yet, in the words of the thing that is
 * missing.
 *
 * A greyed-out button with a tooltip makes someone hunt for the reason. The
 * button's own place is the cheapest place to put it, so the control states its
 * own precondition and nobody has to hover to find out.
 */
export function getCommitBlocker(match: Match): string | null {
  if (getMatchCommitState(match) !== "Disabled") return null;

  const players = entrantPlayers(match.entrants);
  if (players.length === 0) return "No players yet";
  if (match.rounds.length === 0) return "No songs yet";

  /* Counting the players still without points would promise that every one of
     them needs some, and a hand-scored match does not: one point is a result. */
  if (handScoredRoundOf(match)) return "No points assigned";

  const missing = match.rounds.reduce(
    (count, round) =>
      count +
      players.filter((player) => !(round.standings ?? []).some((standing) => standing.player.id === player.id))
        .length,
    0,
  );
  return `${missing} score${missing !== 1 ? "s" : ""} missing`;
}

export function getActiveLabel(active: boolean): string {
  return active ? "Match active" : "Match not active";
}

/** Neutral badge shell. The glyph inside it carries the state. */
export const commitBadgeClass =
  "inline-flex items-center gap-1.5 rounded-full border border-ui-border bg-ui-raised py-0.5 pl-1.5 pr-2.5 text-[11px] font-medium text-ui-text-soft";
