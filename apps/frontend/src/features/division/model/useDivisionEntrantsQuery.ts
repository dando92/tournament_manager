import { useQuery } from "@tanstack/react-query";
import { listDivisionEntrants } from "@/features/division/api/division.api";
import { divisionKeys } from "@/features/division/api/division.keys";

/**
 * The roster of a division, in seeded order.
 *
 * The summary used to carry it, which meant the tournament tree downloaded
 * every entrant of every division to draw a list of names it never showed. The
 * summary states how many there are and the three places that show the people
 * ask for them here, through one cache entry per division.
 */
export function useDivisionEntrantsQuery(divisionId: number) {
  return useQuery({
    queryKey: divisionKeys.entrants(divisionId),
    queryFn: () => listDivisionEntrants(divisionId),
  });
}
