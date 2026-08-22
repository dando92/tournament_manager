/** The query keys the division reads cache under. See `matches.keys.ts`. */
export const divisionKeys = {
  summary: (divisionId: number) => ["division-summary", divisionId] as const,
  entrants: (divisionId: number) => ["division-entrants", divisionId] as const,
};
