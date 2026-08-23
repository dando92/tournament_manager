import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Division } from "@/features/division/model/types";
import { Entrant } from "@/features/participant/model/types";
import { getDivisionSummary } from "@/features/division/api/division.api";
import { divisionKeys } from "@/features/division/api/division.keys";
import { useDivisionEntrantsQuery } from "@/features/division/model/useDivisionEntrantsQuery";

type UseDivisionPageResult = {
  division: Division | null;
  entrants: Entrant[];
  refreshDivision: () => Promise<void>;
};

/**
 * What every destination under a division reads: its structure, and the people
 * competing in it.
 *
 * They are two requests because they are two questions. Both move on their own
 * now: every write to a division publishes an event that stales them, so
 * nothing here re-reads by hand. `refreshDivision` remains for the one write
 * that still announces nothing — an advancement rule, which is not an
 * aggregate and has no commands of its own yet.
 */
export function useDivisionPage(_tournamentId: number, divisionId: number): UseDivisionPageResult {
  const queryClient = useQueryClient();
  const summaryKey = useMemo(() => divisionKeys.summary(divisionId), [divisionId]);
  const query = useQuery({
    queryKey: summaryKey,
    queryFn: () => getDivisionSummary(divisionId),
  });
  const entrants = useDivisionEntrantsQuery(divisionId);

  const refreshDivision = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: summaryKey }),
      queryClient.invalidateQueries({ queryKey: divisionKeys.entrants(divisionId) }),
    ]);
  }, [queryClient, summaryKey, divisionId]);

  return {
    division: query.data ?? null,
    entrants: entrants.data ?? [],
    refreshDivision,
  };
}
