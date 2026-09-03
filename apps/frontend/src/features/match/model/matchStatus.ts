import { entrantPlayers } from "@/features/participant/model/entrant";
import { canCreateTiebreak } from "@/features/match/model/tiebreaks";
import type { Match, MatchCommitState, Round } from "@/features/match/model/types";
import type { Player } from "@/features/participant/model/types";
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
 * More steps than the three a commit button needs, because "nothing in it yet"
 * and "being played" are not the same thing to anyone running a tournament —
 * and the difference is what tells you which of two unfinished matches to walk
 * over to.
 *
 * A tie splits into two of them for the same reason. `tiebreakRequired` is a
 * match waiting for somebody to open a tiebreak; `tiebreakInProgress` is one
 * whose tiebreak is already on the table and waiting for its values. Both block
 * the commit, and only the first is an action to offer.
 *
 * They map onto the status ring in order, so the glyph fills as the match moves
 * forward and the list still reads in greyscale. See .ai/Design.md.
 */
export type MatchProgress = "empty" | "started" | "tiebreakRequired" | "tiebreakInProgress" | "readyToCommit" | "completed";

const PROGRESS_STATUS: Record<MatchProgress, Status> = {
  empty: "idle",
  started: "running",
  tiebreakRequired: "pending",
  tiebreakInProgress: "pending",
  readyToCommit: "pending",
  completed: "done",
};

const PROGRESS_LABEL: Record<MatchProgress, string> = {
  empty: "Empty",
  started: "In progress",
  tiebreakRequired: "Tiebreak required",
  tiebreakInProgress: "Tiebreak in progress",
  readyToCommit: "Ready to commit",
  completed: "Completed",
};

export function getMatchProgress(match: Match): MatchProgress {
  if (match.matchResult) return "completed";
  /* A tie nobody can open a tiebreak for is one whose tiebreak exists already:
     asking for another would be refused, and the values it is waiting for are
     in the table below. */
  if (match.resultState.status === "tiebreak_required") {
    return canCreateTiebreak(match) ? "tiebreakRequired" : "tiebreakInProgress";
  }
  if (match.resultState.status === "ready") return "readyToCommit";
  if (match.rounds.length === 0) return "empty";

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
  if (progress === "tiebreakRequired" || progress === "tiebreakInProgress") return "Tiebreak";
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
