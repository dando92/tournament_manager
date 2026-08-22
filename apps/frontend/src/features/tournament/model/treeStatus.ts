import type { Status } from "@/shared/components/ui/status";
import type { PhaseGroup, PhaseGroupState } from "@/features/division/types/Phase";
import type { TournamentDivisionOption, TournamentDivisionOptionPhase } from "@/features/tournament/model/types";

/**
 * What a branch of the tree is doing.
 *
 * Navigation icons in the tree are neutral — they say only what a thing is —
 * so the one coloured mark on a structural node is this glyph. It is what lets
 * a collapsed sidebar answer "where is something happening" without opening
 * anything. See .ai/Design.md.
 */

const POOL_STATUS: Record<PhaseGroupState, Status> = {
  pending: "idle",
  active: "running",
  completed: "done",
};

/**
 * How states combine on the way up the tree.
 *
 * `pending` outranks `running` because a live match asks nothing of anybody
 * while it is being played, and a match with every score in is stuck until a
 * person commits it. The sidebar's first job is therefore to point at the
 * branch that is waiting, not at the branch that is busy. A branch counts as
 * `done` only when every child is done, which is why that case is handled
 * apart from the ranking.
 */
const RANK: Record<Status, number> = { idle: 0, done: 1, running: 2, pending: 3, failed: 4 };

export function rollUpStatus(children: Status[]): Status {
  if (children.length === 0) return "idle";
  if (children.every((status) => status === "done")) return "done";
  return children.reduce((strongest, status) => (RANK[status] > RANK[strongest] ? status : strongest), "idle" as Status);
}

/**
 * The pool is the bottom rung of the tree and the only node that can see its
 * matches, so this is where a match waiting on a person enters the roll-up.
 * Everything above inherits it unchanged.
 */
export function poolStatus(phaseGroup: PhaseGroup): Status {
  if ((phaseGroup.pendingMatchCount ?? 0) > 0) return "pending";
  if (phaseGroup.matchCount === 0) return "idle";
  return POOL_STATUS[phaseGroup.state] ?? "idle";
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
