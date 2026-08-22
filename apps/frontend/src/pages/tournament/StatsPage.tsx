import { useMemo } from "react";
import TournamentOverviewSummary from "@/features/tournament/ui/overview/TournamentOverviewSummary";
import TournamentStatsPlayerList from "@/features/tournament/ui/stats/TournamentStatsPlayerList";
import TournamentStatsSearch from "@/features/tournament/ui/stats/TournamentStatsSearch";
import { useTournamentPageContext } from "@/features/tournament/model/TournamentPageContext";
import { useTournamentStatsData } from "@/features/tournament/model/useTournamentStatsData";
import { useTournamentStatsPage } from "@/features/tournament/model/useTournamentStatsPage";

/**
 * The tournament's numbers.
 *
 * The workspace totals used to open the Overview page. They belong here: they
 * are statistics, and Overview's other job — listing divisions to click into —
 * is now the tree's.
 */
export default function StatsPage() {
  const { tournamentId, divisions: structure } = useTournamentPageContext();
  const { divisions, loaded } = useTournamentStatsData(tournamentId);
  const { search, setSearch, expandedPlayers, playerScores, groupedPlayers, togglePlayer } =
    useTournamentStatsPage(divisions);

  const totals = useMemo(
    () => ({
      divisionCount: structure.length,
      playerCount: structure.reduce(
        (count, division) =>
          count + (division.entrants?.filter((entrant) => entrant.status === "active").length ?? 0),
        0,
      ),
      matchCount: structure.reduce(
        (count, division) => count + division.phases.reduce((sum, phase) => sum + phase.matchCount, 0),
        0,
      ),
    }),
    [structure],
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <TournamentOverviewSummary
        divisionCount={totals.divisionCount}
        playerCount={totals.playerCount}
        matchCount={totals.matchCount}
      />

      {!loaded ? (
        <p className="text-sm italic text-ui-text-mute">Loading stats...</p>
      ) : playerScores.length === 0 ? (
        <p className="text-sm italic text-ui-text-mute">No scores recorded yet.</p>
      ) : (
        <>
          <div>
            <h2 className="text-xl font-bold text-ui-text">Scores</h2>
            <p className="text-sm text-ui-text-mute">
              {playerScores.length} recorded score{playerScores.length !== 1 ? "s" : ""} across{" "}
              {groupedPlayers.length} player{groupedPlayers.length !== 1 ? "s" : ""}
            </p>
          </div>

          <TournamentStatsSearch search={search} onSearchChange={setSearch} />

          {groupedPlayers.length === 0 ? (
            <p className="text-sm italic text-ui-text-mute">No players match your search.</p>
          ) : (
            <TournamentStatsPlayerList
              groupedPlayers={groupedPlayers}
              expandedPlayers={expandedPlayers}
              onTogglePlayer={togglePlayer}
            />
          )}
        </>
      )}
    </div>
  );
}
