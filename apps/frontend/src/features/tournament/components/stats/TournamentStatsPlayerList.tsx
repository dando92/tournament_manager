import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import { PlayerScoreRow, scoreBadgeClass } from "@/features/tournament/hooks/useTournamentStatsPage";

type GroupedPlayer = {
  playerId: number;
  playerName: string;
  rows: PlayerScoreRow[];
  averageScore: number;
};

type Props = {
  groupedPlayers: GroupedPlayer[];
  expandedPlayers: ReadonlySet<number>;
  onTogglePlayer: (playerId: number) => void;
};

export default function TournamentStatsPlayerList({
  groupedPlayers,
  expandedPlayers,
  onTogglePlayer,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      {groupedPlayers.map((player) => {
        const isOpen = expandedPlayers.has(player.playerId);
        return (
          <div
            key={player.playerId}
            className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
          >
            <button
              type="button"
              onClick={() => onTogglePlayer(player.playerId)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <FontAwesomeIcon
                icon={isOpen ? faChevronUp : faChevronDown}
                className="text-gray-400 text-xs w-3 shrink-0"
              />
              <span className="flex-1 font-semibold text-gray-900 truncate">
                {player.playerName}
              </span>
              <span className="shrink-0 text-xs text-gray-500">
                {player.rows.length} score{player.rows.length !== 1 ? "s" : ""}
              </span>
              <span
                className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded border ${scoreBadgeClass(player.averageScore, false)}`}
              >
                Avg {player.averageScore.toFixed(2)}%
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 bg-gray-50 p-3">
                <div className="flex flex-col gap-2">
                  {player.rows.map((row) => (
                    <div
                      key={row.id}
                      className="grid gap-2 rounded-lg border border-gray-200 bg-white px-3 py-3 md:grid-cols-[minmax(0,1.3fr)_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {row.songArtist
                            ? `${row.songArtist} - ${row.songTitle}`
                            : row.songTitle}
                        </div>
                        <div className="text-xs text-gray-500">
                          {row.divisionName} / {row.phaseName} / {row.matchName}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 justify-start md:justify-end flex-wrap">
                        <span className="text-xs text-gray-500">{row.points} pts</span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded border ${scoreBadgeClass(row.percentage, row.isFailed)}`}
                        >
                          {row.isFailed ? "FAILED" : `${row.percentage.toFixed(2)}%`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
