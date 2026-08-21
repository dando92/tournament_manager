import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faPlus, faPencil } from "@fortawesome/free-solid-svg-icons";
import { Match } from "@/features/match/types/Match";
import { Player } from "@/features/player/types/Player";
import DeleteConfirmButton from "@/shared/components/ui/DeleteConfirmButton";
import { btnCreateIcon } from "@/styles/buttonStyles";
import MobileScoreActionsMenu, {
  type MobileScoreMenuState,
  type ScoreEntry,
} from "@/features/match/components/row/MobileScoreActionsMenu";

type MatchRowProps = {
  match: Match;
  player: Player;
  controls: boolean;
  scoreTable: Record<string, ScoreEntry>;
  hasRoute?: boolean;
  isRouteSelected?: boolean;
  routeTargetMatchId?: number | null;
  routeTargetLabel?: string;
  canClearRouteHighlight?: boolean;
  onToggleRouteHighlight?: () => void;
  onClearRouteHighlight?: () => void;
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
  controls,
  scoreTable,
  hasRoute = false,
  isRouteSelected = false,
  routeTargetMatchId = null,
  routeTargetLabel,
  canClearRouteHighlight = false,
  onToggleRouteHighlight,
  onClearRouteHighlight,
  onOpenAddStanding,
  onDeletePlayer,
  onOpenEditStanding,
  onDeleteStanding,
}: MatchRowProps) {
  const [mobileScoreMenu, setMobileScoreMenu] = useState<MobileScoreMenuState | null>(null);
  const matchResultPoints = match.matchResult?.playerPoints?.find((entry) => entry.playerId === player.id)?.points;
  const totalPoints = matchResultPoints ?? match.rounds
    .map((r) => (r.standings ?? []).find((s) => s.score.player.id === player.id))
    .reduce((acc, s) => acc + (s?.points ?? 0), 0);
  const canToggleRoute = Boolean(match.matchResult && routeTargetMatchId && onToggleRouteHighlight);
  const canClickCompletedRow = Boolean(match.matchResult && (canToggleRoute || canClearRouteHighlight));

  useEffect(() => {
    if (!mobileScoreMenu) return;

    const close = () => setMobileScoreMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("click", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("click", close);
    };
  }, [mobileScoreMenu]);

  return (
    <tr
      className={`border-t transition-colors ${
        isRouteSelected
          ? "border-state-done/30 bg-state-done/10"
          : "border-ui-border odd:bg-ui-surface even:bg-ui-raised"
      } ${canClickCompletedRow ? "cursor-pointer sm:hover:bg-state-done/10" : ""}`}
      onClick={() => {
        if (canToggleRoute && routeTargetMatchId) {
          onToggleRouteHighlight?.();
          return;
        }
        if (canClearRouteHighlight) onClearRouteHighlight?.();
      }}
    >
      <td className="px-2 py-2 text-center w-8">
        {controls && !match.matchResult && onDeletePlayer && (
          <DeleteConfirmButton
            onConfirm={() => onDeletePlayer(player.id)}
            title="Remove player from match"
            className="text-xs shrink-0"
            confirmMessage={`Remove "${player.playerName}" from this match?`}
            confirmText="Remove"
          />
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2 relative">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`font-medium truncate ${hasRoute ? "text-ui-text-soft" : "text-ui-text"}`}
              title={routeTargetLabel}
            >
              {player.playerName}
            </span>
          </div>
        </div>
      </td>

      {match.rounds.map((round) => {
        const key = `${player.id}-${round.song.id}`;
        const scoreData = scoreTable[key];
        const playerDisabled = scoreData?.isFailed && scoreData?.percentage === -1;

        if (playerDisabled) {
          return (
            <td key={round.song.id} className="px-1 sm:px-3 py-2 bg-ui-selected text-center">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-ui-text-mute italic">disabled</span>
                {controls && (
                  <button
                    onClick={() => onDeleteStanding(player.id, round.song.id)}
                    className="text-xs text-ui-text-soft hover:underline"
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
                  className={btnCreateIcon}
                >
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              ) : (
                <span className="text-ui-border-strong">—</span>
              )}
            </td>
          );
        }

        return (
          <td
            key={round.song.id}
            className={`px-1 sm:px-3 py-2 text-center ${scoreData.isFailed ? "bg-state-failed/10" : ""}`}
          >
            <div
              className={`relative inline-flex flex-col items-center gap-0.5 ${
                controls ? "w-full sm:w-auto cursor-pointer sm:cursor-default" : ""
              }`}
              onClick={(event) => {
                if (!controls) return;
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                setMobileScoreMenu((current) =>
                  current?.songId === round.song.id && current.scoreId === scoreData.scoreId
                    ? null
                    : {
                        songId: round.song.id,
                        scoreId: scoreData.scoreId,
                        x: Math.min(rect.right, window.innerWidth - 8),
                        y: rect.bottom + 4,
                        scoreData,
                        songTitle: round.song.title,
                      },
                );
              }}
            >
              <div className="flex min-h-7 items-center justify-center gap-1.5">
                <span className={`font-bold text-base ${scoreData.isFailed ? "text-state-failed" : "text-ui-text"}`}>
                  {scoreData.percentage.toFixed(2)}%
                </span>
                {scoreData.isFailed && (
                  <span className="text-xs bg-state-failed/10 text-state-failed px-1 rounded font-semibold">F</span>
                )}
                {controls && (
                  <FontAwesomeIcon icon={faChevronDown} className="sm:hidden text-xs text-ui-text-mute" />
                )}
                {controls && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenEditStanding(
                        player.id,
                        round.song.id,
                        player.playerName,
                        round.song.title,
                        scoreData.scoreId,
                        scoreData.percentage,
                        scoreData.score,
                        scoreData.isFailed,
                      );
                    }}
                    title="Edit score"
                    className="hidden sm:inline-flex h-6 w-6 items-center justify-center text-ui-text-mute hover:text-ui-text"
                  >
                    <FontAwesomeIcon icon={faPencil} className="text-sm" />
                  </button>
                )}
              </div>
              <div className="flex min-h-6 items-center justify-center gap-1.5">
                <span className="text-xs text-ui-text-mute">{scoreData.score} pts</span>
                {controls && (
                  <DeleteConfirmButton
                    onConfirm={() => onDeleteStanding(player.id, round.song.id)}
                    title="Delete score"
                    className="hidden sm:inline-flex h-6 w-6 items-center justify-center shrink-0"
                    iconClassName="text-sm"
                    confirmMessage={`Delete ${player.playerName}'s score for "${round.song.title}"?`}
                    stopPropagation
                  />
                )}
              </div>
            </div>
          </td>
        );
      })}

      <td className="px-1 sm:px-3 py-2 text-center border-l border-ui-border">
        <span className="font-bold text-ui-text-soft">{totalPoints}</span>
      </td>
      {mobileScoreMenu && (
        <MobileScoreActionsMenu
          menu={mobileScoreMenu}
          playerId={player.id}
          playerName={player.playerName}
          onClose={() => setMobileScoreMenu(null)}
          onOpenEditStanding={onOpenEditStanding}
          onDeleteStanding={onDeleteStanding}
        />
      )}
    </tr>
  );
}
