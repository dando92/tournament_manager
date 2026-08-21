import type { Status } from "@/shared/components/ui/status";
import type { PhaseGroup, PhaseGroupState } from "@/features/division/types/Phase";
import type { TournamentDivisionOption, TournamentDivisionOptionPhase } from "@/features/tournament/types/TournamentDivisionOption";

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
 * `running` outranks everything because during a tournament the first question
 * asked of the sidebar is what is live right now. A branch counts as `done`
 * only when every child is done, which is why that case is handled apart from
 * the ranking.
 */
const RANK: Record<Status, number> = { idle: 0, done: 1, pending: 2, running: 3, failed: 4 };

export function rollUpStatus(children: Status[]): Status {
  if (children.length === 0) return "idle";
  if (children.every((status) => status === "done")) return "done";
  return children.reduce((strongest, status) => (RANK[status] > RANK[strongest] ? status : strongest), "idle" as Status);
}

export function poolStatus(phaseGroup: PhaseGroup): Status {
  if (phaseGroup.matchCount === 0) return "idle";
  return POOL_STATUS[phaseGroup.state] ?? "idle";
}

export function phaseStatus(phase: TournamentDivisionOptionPhase): Status {
  return rollUpStatus((phase.phaseGroups ?? []).map(poolStatus));
}

export function divisionStatus(division: TournamentDivisionOption): Status {
  return rollUpStatus(division.phases.map(phaseStatus));
}
