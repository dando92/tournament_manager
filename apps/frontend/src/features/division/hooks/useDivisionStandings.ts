import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useTournamentUpdates } from "@/features/tournament/context/TournamentUpdatesContext";
import { DivisionStandingRow } from "@/features/division/types/DivisionStandingRow";

export function useDivisionStandings(divisionId: number) {
  const { divisionDetailVersions, matchListVersions } = useTournamentUpdates();
  const divisionDetailVersion = divisionDetailVersions.get(divisionId) ?? 0;
  const matchListVersion = matchListVersions.get(divisionId) ?? 0;
  const [rows, setRows] = useState<DivisionStandingRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refreshRows = useCallback(async () => {
    const response = await axios.get<DivisionStandingRow[]>(`divisions/${divisionId}/standings`);
    setRows(response.data);
    setLoaded(true);
  }, [divisionId]);

  useEffect(() => {
    refreshRows().catch(() => {});
  }, [refreshRows]);

  useEffect(() => {
    if (divisionDetailVersion === 0 && matchListVersion === 0) return;
    refreshRows().catch(() => {});
  }, [divisionDetailVersion, matchListVersion, refreshRows]);

  return {
    rows,
    loaded,
  };
}
