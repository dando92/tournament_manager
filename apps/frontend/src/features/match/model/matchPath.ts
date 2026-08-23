import { phaseGroupLabel } from "@/features/division/model/phaseGroupLabel";
import type { TournamentDivisionOption } from "@/features/tournament/model/types";
import type { PathLevel, PathValue } from "@/shared/components/ui/cascadingPath";

/**
 * Where a match is created: the division, the phase, and the pool under it.
 *
 * A match belongs to a pool and the request carries nothing else, but a pool
 * identifier alone cannot be chosen — it is only meaningful under the phase and
 * division that hold it. So the modal keeps the whole path and reads the pool
 * off its end.
 *
 * The path is one value rather than three pieces of state, and completeness is
 * derived from it rather than tracked beside it: a form cannot then disagree
 * with itself about whether the destination it holds is a real one.
 */

export type MatchPath = {
  divisionId: number | null;
  phaseId: number | null;
  phaseGroupId: number | null;
};

export type CompleteMatchPath = {
  divisionId: number;
  phaseId: number;
  phaseGroupId: number;
};

export function isCompleteMatchPath(path: MatchPath): path is CompleteMatchPath {
  return path.divisionId !== null && path.phaseId !== null && path.phaseGroupId !== null;
}

/**
 * The levels the picker draws, read off the tournament structure the tree
 * already holds. Each one only knows how to narrow what the level above it
 * settled, which is the whole of the hierarchy the picker needs to know.
 */
export function matchPathLevels(divisions: TournamentDivisionOption[]): PathLevel<number>[] {
  const phasesOf = (divisionId: number | null) =>
    divisions.find((division) => division.id === divisionId)?.phases ?? [];

  return [
    {
      key: "division",
      label: "Division",
      getOptions: () => divisions.map((division) => ({ value: division.id, label: division.name })),
    },
    {
      key: "phase",
      label: "Phase",
      getOptions: ([divisionId]) =>
        phasesOf(divisionId).map((phase) => ({ value: phase.id, label: phase.name })),
    },
    {
      key: "phaseGroup",
      label: "Pool",
      getOptions: ([divisionId, phaseId]) =>
        (phasesOf(divisionId).find((phase) => phase.id === phaseId)?.phaseGroups ?? []).map((pool) => ({
          value: pool.id,
          label: phaseGroupLabel(pool),
        })),
    },
  ];
}

/* The picker speaks in levels and the modal speaks in names. Both say the same
   thing in the same order, so translating between them is positional. */

export function matchPathValue(path: MatchPath): PathValue<number> {
  return [path.divisionId, path.phaseId, path.phaseGroupId];
}

export function matchPathFromValue(value: PathValue<number>): MatchPath {
  const [divisionId = null, phaseId = null, phaseGroupId = null] = value;
  return { divisionId, phaseId, phaseGroupId };
}
