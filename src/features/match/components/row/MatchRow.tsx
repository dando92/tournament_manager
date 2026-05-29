import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faPlus, faPencil } from "@fortawesome/free-solid-svg-icons";
import { Match } from "@/features/match/types/Match";
import { Player } from "@/features/player/types/Player";
import DeleteConfirmButton from "@/shared/components/ui/DeleteConfirmButton";

type ScoreEntry = { scoreId: number; score: number; percentage: number; isFailed: boolean };

type MatchRowProps = {
  match: Match;
  player: Player;
  rank: number;
  controls: boolean;
  scoreTable: Record<string, ScoreEntry>;
  highlightRoute?: boolean;
  routeMatchName?: string | null;
  onOpenAddStanding: (playerId: number, songId: number, playerName: string, songTitle: string) => void;
  onDeletePlayer?: (playerId: number) => void;
  onOpenEditStanding: (
    playerId: number,
    songId: number,
    playerName: string,
    songTitle: string,
    scoreId: number,
    percentage: number,
    score: number,
    isFailed: boolean,
  ) => void;
  onDeleteStanding: (playerId: number, songId: number) => void;
};

export default function MatchRow({
  match,
  player,
  rank,
  controls,
  scoreTable,
  highlightRoute = false,
  routeMatchName = null,
  onOpenAddStanding,
  onDeletePlayer,
  onOpenEditStanding,
  onDeleteStanding,
}: MatchRowProps) {
  const [showMobileTooltip, setShowMobileTooltip] = useState(false);
  const matchResultPoints = match.matchResult?.playerPoints?.find((entry) => entry.playerId === player.id)?.points;
  const totalPoints = matchResultPoints ?? match.rounds
    .map((r) => (r.standings ?? []).find((s) => s.score.player.id === player.id))
    .reduce((acc, s) => acc + (s?.points ?? 0), 0);

  useEffect(() => {
    if (!showMobileTooltip) return;

    const close = () => setShowMobileTooltip(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("click", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("click", close);
    };
  }, [showMobileTooltip]);

  return (
    <tr className={`border-t ${highlightRoute ? "border-emerald-100 bg-emerald-50/70" : "border-gray-100 odd:bg-white even:bg-gray-50"}`}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2 relative">
          <span className="text-xs font-bold text-gray-300 w-5 shrink-0">#{rank + 1}</span>
          <div className="flex items-center gap-2 min-w-0">
            <span className={`font-medium truncate ${highlightRoute ? "text-emerald-700" : "text-gray-800"}`}>{player.playerName}</span>
            {controls && !match.matchResult && onDeletePlayer && (
              <DeleteConfirmButton
                onConfirm={() => onDeletePlayer(player.id)}
                title="Remove player from match"
                className="text-xs shrink-0"
                confirmMessage={`Remove "${player.playerName}" from this match?`}
                confirmText="Remove"
              />
            )}
            {routeMatchName ? (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowMobileTooltip((current) => !current);
                  }}
                  className="sm:hidden inline-flex items-center text-emerald-700"
                  aria-label={`Route to ${routeMatchName}`}
                  title={routeMatchName}
                >
                  <FontAwesomeIcon icon={faArrowRight} className="shrink-0" />
                </button>
                <span className="hidden sm:inline-flex items-center gap-1 truncate text-sm font-medium text-emerald-700 shrink">
                  <FontAwesomeIcon icon={faArrowRight} className="shrink-0" />
                  <span className="truncate">{routeMatchName}</span>
                </span>
                {showMobileTooltip && (
                  <div className="sm:hidden absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full z-10">
                    <div className="relative rounded bg-gray-800 px-2 py-1 text-xs font-medium text-white shadow-lg whitespace-nowrap">
                      {routeMatchName}
                      <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </td>

      {match.rounds.map((round) => {
        const key = `${player.id}-${round.song.id}`;
        const scoreData = scoreTable[key];
        const playerDisabled = scoreData?.isFailed && scoreData?.percentage === -1;

        if (playerDisabled) {
          return (
            <td key={round.song.id} className="px-1 sm:px-3 py-2 bg-gray-100 text-center">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-gray-400 italic">disabled</span>
                {controls && (
                  <button
                    onClick={() => onDeleteStanding(player.id, round.song.id)}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    reactivate
                  </button>
                )}
              </div>
            </td>
          );
        }

        if (!scoreData) {
          return (
            <td key={round.song.id} className="px-1 sm:px-3 py-2 text-center">
              {controls ? (
                <button
                  onClick={() => onOpenAddStanding(player.id, round.song.id, player.playerName, round.song.title)}
                  title="Add score"
                  className="text-green-700 hover:text-green-900"
                >
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              ) : (
                <span className="text-gray-300">—</span>
              )}
            </td>
          );
        }

        return (
          <td
            key={round.song.id}
            className={`px-1 sm:px-3 py-2 text-center ${scoreData.isFailed ? "bg-red-50" : ""}`}
          >
            <div className="inline-flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1">
                <span className={`font-bold text-base ${scoreData.isFailed ? "text-red-600" : "text-gray-800"}`}>
                  {scoreData.percentage.toFixed(2)}%
                </span>
                {scoreData.isFailed && (
                  <span className="text-xs bg-red-100 text-red-600 px-1 rounded font-semibold">F</span>
                )}
              </div>
              <div className="flex items-center justify-center gap-1">
                <span className="text-xs text-gray-400">{scoreData.score} pts</span>
                {controls && (
                  <>
                    <button
                      onClick={() =>
                        onOpenEditStanding(
                          player.id,
                          round.song.id,
                          player.playerName,
                          round.song.title,
                          scoreData.scoreId,
                          scoreData.percentage,
                          scoreData.score,
                          scoreData.isFailed,
                        )
                      }
                      title="Edit score"
                      className="text-xs text-blue-400 hover:text-blue-600 shrink-0"
                    >
                      <FontAwesomeIcon icon={faPencil} />
                    </button>
                    <DeleteConfirmButton
                      onConfirm={() => onDeleteStanding(player.id, round.song.id)}
                      title="Delete score"
                      className="text-xs shrink-0"
                      confirmMessage={`Delete ${player.playerName}'s score for "${round.song.title}"?`}
                    />
                  </>
                )}
              </div>
            </div>
          </td>
        );
      })}

      <td className="px-1 sm:px-3 py-2 text-center border-l border-gray-100">
        <span className="font-bold text-gray-700">{totalPoints}</span>
      </td>
    </tr>
  );
}
