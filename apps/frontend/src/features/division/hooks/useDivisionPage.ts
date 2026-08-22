import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Division } from "@/features/division/types/Division";
import { getDivisionSummary } from "@/features/division/services/divisions.api";
import { divisionKeys } from "@/features/division/services/divisions.keys";

type UseDivisionPageResult = {
  division: Division | null;
  refreshDivision: () => Promise<void>;
};

export function useDivisionPage(_tournamentId: number, divisionId: number): UseDivisionPageResult {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => divisionKeys.summary(divisionId), [divisionId]);
  const query = useQuery({
    queryKey,
    queryFn: () => getDivisionSummary(divisionId),
  });

  const refreshDivision = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    division: query.data ?? null,
    refreshDivision,
  };
}
