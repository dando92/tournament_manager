import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faMinus, faPlus, faPencil } from "@fortawesome/free-solid-svg-icons";
import { Match, Round } from "@/features/match/model/types";
import { Player } from "@/features/player/types/Player";
import DeleteConfirmButton from "@/shared/components/ui/DeleteConfirmButton";
import { btnCreateIcon } from "@/styles/buttonStyles";
import MobileScoreActionsMenu, {
  type MobileScoreMenuState,
  type ScoreEntry,
} from "@/features/match/ui/MobileScoreActionsMenu";

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
  onOpenAddStanding: (playerId: number, roundId: number, playerName: string, songTitle: string) => void;
  onDeletePlayer?: (playerId: number) => void;
  onOpenEditStanding: (
    playerId: number,
    roundId: number,
    playerName: string,
    songTitle: string,
    scoreId: number,
    percentage: number,
    score: number,
    isFailed: boolean,
  ) => void;
  onDeleteStanding: (playerId: number, roundId: number) => void;
  /** Writes the points of a hand-scored round, which has no score to enter. */
  onChangePoints: (playerId: number, roundId: number, points: number) => void;
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
  onChangePoints,
}: MatchRowProps) {
  const [mobileScoreMenu, setMobileScoreMenu] = useState<MobileScoreMenuState | null>(null);
  const matchResultPoints = match.matchResult?.playerPoints?.find((entry) => entry.playerId === player.id)?.points;
  const totalPoints = matchResultPoints ?? match.rounds
    .map((r) => (r.standings ?? []).find((s) => s.player.id === player.id))
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

  /**
   * A hand-scored round has no score to open a modal for: the points are the
   * whole content of the cell, so they are typed in place.
   */
  function handScoredCell(round: Round) {
    const points = (round.standings ?? []).find((standing) => standing.player.id === player.id)?.points ?? 0;

    return (
      <td key={round.id} className="px-1 sm:px-3 py-2 text-center">
        {controls ? (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={points <= 0}
              onClick={(event) => {
                event.stopPropagation();
                onChangePoints(player.id, round.id, Math.max(0, points - 1));
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-ui-border text-ui-text-soft hover:bg-ui-selected disabled:cursor-not-allowed disabled:opacity-40"
              title="Decrease points"
            >
              <FontAwesomeIcon icon={faMinus} />
            </button>
            <span className="w-8 text-center font-bold text-ui-text-soft">{points}</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onChangePoints(player.id, round.id, points + 1);
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-ui-border text-ui-text-soft hover:bg-ui-selected"
              title="Increase points"
            >
              <FontAwesomeIcon icon={faPlus} />
            </button>
          </div>
        ) : (
          <span className="font-bold text-ui-text-soft">{points}</span>
        )}
      </td>
    );
  }

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
        if (round.song === null) {
          return handScoredCell(round);
        }

        const song = round.song;
        const key = `${player.id}-${round.id}`;
        const scoreData = scoreTable[key];
        const playerDisabled = scoreData?.isFailed && scoreData?.percentage === -1;

        if (playerDisabled) {
          return (
            <td key={round.id} className="px-1 sm:px-3 py-2 bg-ui-selected text-center">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-ui-text-mute italic">disabled</span>
                {controls && (
                  <button
                    onClick={() => onDeleteStanding(player.id, round.id)}
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
            <td key={round.id} className="px-1 sm:px-3 py-2 text-center">
              {controls ? (
                <button
                  onClick={() => onOpenAddStanding(player.id, round.id, player.playerName, song.title)}
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
            key={round.id}
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
                  current?.roundId === round.id && current.scoreId === scoreData.scoreId
                    ? null
                    : {
                        roundId: round.id,
                        scoreId: scoreData.scoreId,
                        x: Math.min(rect.right, window.innerWidth - 8),
                        y: rect.bottom + 4,
                        scoreData,
                        songTitle: song.title,
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
                        round.id,
                        player.playerName,
                        song.title,
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
                    onConfirm={() => onDeleteStanding(player.id, round.id)}
                    title="Delete score"
                    className="hidden sm:inline-flex h-6 w-6 items-center justify-center shrink-0"
                    iconClassName="text-sm"
                    confirmMessage={`Delete ${player.playerName}'s score for "${song.title}"?`}
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
