import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Division } from "@/features/division/types/Division";
import { useTournamentUpdates } from "@/features/tournament/context/TournamentUpdatesContext";

export function useTournamentStatsData(tournamentId: number) {
  const { tournamentVersion } = useTournamentUpdates();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const response = await axios.get<Division[]>("divisions", { params: { tournamentId } });
    setDivisions(response.data);
    setLoaded(true);
  }, [tournamentId]);

  useEffect(() => {
    refresh().catch(() => {
      setLoaded(true);
    });
  }, [refresh]);

  useEffect(() => {
    if (tournamentVersion === 0) return;
    refresh().catch(() => {});
  }, [refresh, tournamentVersion]);

  return {
    divisions,
    loaded,
  };
}
