/** The query keys the division summary caches under. See `matches.keys.ts`. */
export const divisionKeys = {
  summary: (divisionId: number) => ["division-summary", divisionId] as const,
};
