import PlayersTab from "@/features/division/ui/PlayersTab";
import { useDivisionPageContext } from "@/features/division/model/DivisionPageContext";
import { useTournamentTree } from "@/features/tournament/model/TournamentTreeContext";

export default function DivisionPlayersPage() {
  const { division, entrants, controls } = useDivisionPageContext();
  const { tournamentName, divisions } = useTournamentTree();
  return (
    <PlayersTab
      division={division}
      entrants={entrants}
      canEdit={controls}
      tournamentName={tournamentName}
      divisionIds={divisions.map((candidate) => candidate.id)}
    />
  );
}
