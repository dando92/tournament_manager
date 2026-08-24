import type { Status } from "@/shared/components/ui/status";
import type { PhaseGroup } from "@/features/division/model/types";
import type { TournamentDivisionOption, TournamentDivisionOptionPhase } from "@/features/tournament/model/types";

/**
 * What a branch of the tree is doing.
 *
 * Navigation icons in the tree are neutral — they say only what a thing is —
 * so the one coloured mark on a structural node is this glyph. It is what lets
 * a collapsed sidebar answer "where is something happening" without opening
 * anything. See .ai/Design.md.
 */

/**
 * How states combine on the way up the tree.
 *
 * `pending` outranks `running` because a match with every score in is stuck
 * until a person commits it. A branch counts as `done` only when every child is
 * done; one done child in an unfinished branch is evidence of partial progress
 * and therefore rolls up as `running`.
 */
export function rollUpStatus(children: Status[]): Status {
  if (children.length === 0) return "idle";
  if (children.every((status) => status === "done")) return "done";
  if (children.some((status) => status === "failed")) return "failed";
  if (children.some((status) => status === "pending")) return "pending";
  if (children.some((status) => status === "running" || status === "done")) return "running";
  return "idle";
}

/**
 * The pool is the bottom rung of the tree and the only node that can see its
 * matches, so this is where competition evidence and a match waiting on a
 * person enter the roll-up. Configuration alone leaves it idle.
 */
export function poolStatus(phaseGroup: PhaseGroup): Status {
  if ((phaseGroup.pendingMatchCount ?? 0) > 0) return "pending";
  if (phaseGroup.state === "completed" && phaseGroup.matchCount > 0) return "done";
  if ((phaseGroup.progressedMatchCount ?? 0) > 0) return "running";
  if (phaseGroup.matchCount === 0) return "idle";
  return "idle";
}

export function phaseStatus(phase: TournamentDivisionOptionPhase): Status {
  return rollUpStatus((phase.phaseGroups ?? []).map(poolStatus));
}

export function divisionStatus(division: TournamentDivisionOption): Status {
  return rollUpStatus(division.phases.map(phaseStatus));
}

/**
 * The top of the roll-up, and the only node whose structure may be missing:
 * the tree loads one tournament at a time, so a tournament that is not the
 * current one has nothing to report and keeps its own icon instead.
 */
export function tournamentStatus(divisions: TournamentDivisionOption[]): Status | undefined {
  if (divisions.length === 0) return undefined;
  return rollUpStatus(divisions.map(divisionStatus));
}
