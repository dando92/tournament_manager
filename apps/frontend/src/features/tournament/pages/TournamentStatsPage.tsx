import TournamentStatsPlayerList from "@/features/tournament/components/stats/TournamentStatsPlayerList";
import TournamentStatsSearch from "@/features/tournament/components/stats/TournamentStatsSearch";
import { useTournamentPageContext } from "@/features/tournament/context/TournamentPageContext";
import { useTournamentStatsData } from "@/features/tournament/hooks/useTournamentStatsData";
import { useTournamentStatsPage } from "@/features/tournament/hooks/useTournamentStatsPage";

export default function TournamentStatsPage() {
  const { tournamentId } = useTournamentPageContext();
  const { divisions, loaded } = useTournamentStatsData(tournamentId);
  const {
    search,
    setSearch,
    expandedPlayers,
    playerScores,
    groupedPlayers,
    togglePlayer,
  } = useTournamentStatsPage(divisions);

  if (!loaded) {
    return <p className="text-sm text-gray-400 italic">Loading stats...</p>;
  }

  if (playerScores.length === 0) {
    return <p className="text-sm text-gray-400 italic">No scores recorded yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto">
      <div>
        <h2 className="text-primary-dark font-bold text-xl">Stats</h2>
        <p className="text-sm text-gray-500">
          {playerScores.length} recorded score{playerScores.length !== 1 ? "s" : ""} across{" "}
          {groupedPlayers.length} player{groupedPlayers.length !== 1 ? "s" : ""}
        </p>
      </div>

      <TournamentStatsSearch search={search} onSearchChange={setSearch} />

      {groupedPlayers.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No players match your search.</p>
      ) : (
        <TournamentStatsPlayerList
          groupedPlayers={groupedPlayers}
          expandedPlayers={expandedPlayers}
          onTogglePlayer={togglePlayer}
        />
      )}
    </div>
  );
}
