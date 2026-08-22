import { useCallback, useEffect, useState } from "react";
import { useTournamentUpdates } from "@/features/tournament/model/TournamentUpdatesContext";
import { listDivisionStandings } from "@/features/division/api/division.api";
import { DivisionStandingRow } from "@/features/division/model/types";

export function useDivisionStandings(divisionId: number) {
  const { divisionDetailVersions, matchListVersions } = useTournamentUpdates();
  const divisionDetailVersion = divisionDetailVersions.get(divisionId) ?? 0;
  const matchListVersion = matchListVersions.get(divisionId) ?? 0;
  const [rows, setRows] = useState<DivisionStandingRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refreshRows = useCallback(async () => {
    setRows(await listDivisionStandings(divisionId));
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
