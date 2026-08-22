import { useQuery } from "@tanstack/react-query";
import { listPublicTournaments } from "@/features/tournament/services/tournament.api";
import { tournamentKeys } from "@/features/tournament/services/tournament.keys";

/**
 * Every tournament anybody may open.
 *
 * The home page and the search dialog ask the same question, so they share one
 * cache entry rather than one request each.
 */
export function usePublicTournamentsQuery(enabled = true) {
  return useQuery({
    queryKey: tournamentKeys.publicList(),
    enabled,
    queryFn: listPublicTournaments,
  });
}
