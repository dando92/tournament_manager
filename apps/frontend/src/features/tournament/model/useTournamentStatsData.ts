import { useCallback, useEffect, useState } from "react";
import { TournamentStatsDivision } from "@/features/tournament/model/types";
import { listTournamentStatsDivisions } from "@/features/tournament/api/tournament.api";
import { useTournamentUpdates } from "@/features/tournament/model/TournamentUpdatesContext";

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
