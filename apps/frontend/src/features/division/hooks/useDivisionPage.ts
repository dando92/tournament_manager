import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Division } from "@/features/division/types/Division";

type UseDivisionPageResult = {
  division: Division | null;
  refreshDivision: () => Promise<void>;
};

export function useDivisionPage(_tournamentId: number, divisionId: number): UseDivisionPageResult {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["division-summary", divisionId] as const, [divisionId]);
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await axios.get<Division>(`divisions/${divisionId}/summary`);
      return response.data;
    },
  });

  const refreshDivision = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    division: query.data ?? null,
    refreshDivision,
  };
}
