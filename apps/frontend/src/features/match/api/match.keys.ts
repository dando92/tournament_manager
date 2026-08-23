/**
 * The query keys the match list caches under.
 *
 * The realtime listener invalidates the same entries the list reads, and the
 * two used to spell them independently: a key changed on one side and the
 * invalidation silently stopped matching, leaving the interface stale with no
 * error anywhere.
 */
export const matchKeys = {
  byDivision: (divisionId: number) => ["matches", "division", divisionId] as const,
  byPhaseGroup: (phaseGroupId: number) => ["matches", "phase-group", phaseGroupId] as const,
  scoringSystems: () => ["matches", "scoring-systems"] as const,
};
