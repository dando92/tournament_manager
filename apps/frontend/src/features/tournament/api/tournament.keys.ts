/**
 * The query keys the tournament feature caches under.
 *
 * They are declared once because a key written by hand at the reader and again
 * at the writer stops matching the moment one of the two changes, and nothing
 * reports it: the invalidation simply misses.
 */
export const tournamentKeys = {
  publicList: () => ["tournaments", "public"] as const,
  overview: (tournamentId: number) => ["tournament-overview", tournamentId] as const,
  configuration: (tournamentId: number) => ["tournament-configuration", tournamentId] as const,
};
