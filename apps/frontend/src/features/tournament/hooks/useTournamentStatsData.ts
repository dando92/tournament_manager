import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { TournamentStatsDivision } from "@/features/tournament/types/TournamentStats";
import { useTournamentUpdates } from "@/features/tournament/context/TournamentUpdatesContext";

export function useTournamentStatsData(tournamentId: number) {
  const { tournamentVersion } = useTournamentUpdates();
  const [divisions, setDivisions] = useState<TournamentStatsDivision[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const response = await axios.get<TournamentStatsDivision[]>("divisions", { params: { tournamentId } });
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
