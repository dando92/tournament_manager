import TournamentOverviewDivisions from "@/features/tournament/components/overview/TournamentOverviewDivisions";
import TournamentOverviewSummary from "@/features/tournament/components/overview/TournamentOverviewSummary";
import { useTournamentPageContext } from "@/features/tournament/context/TournamentPageContext";
import { useTournamentOverviewPage } from "@/features/tournament/hooks/useTournamentOverviewPage";

export default function TournamentOverviewPage() {
  const { divisions, tournamentId, controls, refreshDivisions } = useTournamentPageContext();
  const { summary, handleDeleteDivision, handleSelectDivision } =
    useTournamentOverviewPage({
      divisions,
      tournamentId,
      refreshDivisions,
    });

  return (
    <div className="flex flex-col gap-6">
      <TournamentOverviewSummary
        divisionCount={summary.divisionCount}
        playerCount={summary.playerCount}
        matchCount={summary.matchCount}
      />
      <TournamentOverviewDivisions
        divisions={divisions}
        controls={controls}
        onSelectDivision={handleSelectDivision}
        onDeleteDivision={handleDeleteDivision}
      />
    </div>
  );
}
