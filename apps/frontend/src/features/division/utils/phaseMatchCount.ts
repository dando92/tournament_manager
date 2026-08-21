import { Phase } from "@/features/division/types/Phase";

/** Matches of a phase, from the loaded list when there is one and from the count the API sends otherwise. */
export function phaseMatchCount(phase: Phase): number {
  return phase.matchCount ?? phase.matches?.length ?? 0;
}

export function matchCountLabel(count: number): string {
  return `${count} match${count !== 1 ? "es" : ""}`;
}
