import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listByDivision } from "@/features/match/api/match.api";
import { matchKeys } from "@/features/match/api/match.keys";
import { Match } from "@/features/match/model/types";

/**
 * Every match of the division, for the advancement editor to point at.
 *
 * A card opened from a pool only holds that pool's matches, and a rule may
 * advance into any of them, so the wider list is fetched when the editor opens
 * rather than kept loaded behind every card. It goes through the cache under
 * the division key, so a pool page that later widens its scope finds it there.
 */
export function useAdvancementTargets(divisionId: number): () => Promise<Match[]> {
  const queryClient = useQueryClient();

  return useCallback(
    () =>
      queryClient.fetchQuery({
        queryKey: matchKeys.byDivision(divisionId),
        queryFn: () => listByDivision(divisionId),
      }),
    [queryClient, divisionId],
  );
}
