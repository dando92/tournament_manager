import { useCallback, useEffect, useState } from "react";
import { TournamentStatsDivision } from "@/features/tournament/types/TournamentStats";
import { listTournamentStatsDivisions } from "@/features/tournament/services/tournament.api";
import { useTournamentUpdates } from "@/features/tournament/context/TournamentUpdatesContext";

export function useTournamentStatsData(tournamentId: number) {
  const { tournamentVersion } = useTournamentUpdates();
  const [divisions, setDivisions] = useState<TournamentStatsDivision[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    setDivisions(await listTournamentStatsDivisions(tournamentId));
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
