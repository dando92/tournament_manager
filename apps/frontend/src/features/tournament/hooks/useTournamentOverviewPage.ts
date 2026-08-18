import axios from "axios";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TournamentDivisionOption } from "@/features/tournament/types/TournamentDivisionOption";

type Params = {
  divisions: TournamentDivisionOption[];
  tournamentId: number;
  refreshDivisions: () => Promise<void>;
};

export function useTournamentOverviewPage({
  divisions,
  tournamentId,
  refreshDivisions,
}: Params) {
  const navigate = useNavigate();

  const summary = useMemo(() => {
    const divisionCount = divisions.length;
    const playerCount = divisions.reduce(
      (count, division) => count + (division.entrants?.filter((entrant) => entrant.status === "active").length ?? 0),
      0,
    );
    const matchCount = divisions.reduce(
      (count, division) =>
        count +
        (division.phases ?? []).reduce((sum, phase) => sum + phase.matchCount, 0),
      0,
    );

    return { divisionCount, playerCount, matchCount };
  }, [divisions]);

  async function handleDeleteDivision(divisionId: number) {
    await axios.delete(`divisions/${divisionId}`);
    await refreshDivisions();
  }

  function handleSelectDivision(divisionId: number) {
    navigate(`/tournament/${tournamentId}/division/${divisionId}/phases`);
  }

  return {
    summary,
    handleDeleteDivision,
    handleSelectDivision,
  };
}
