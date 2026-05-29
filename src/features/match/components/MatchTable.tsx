import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Match } from "@/features/match/types/Match";
import { entrantPlayers } from "@/features/entrant/types/Entrant";
import MatchRow from "@/features/match/components/row/MatchRow";
import PathRow from "@/features/match/components/row/PathRow";
import EditPathRow from "@/features/match/components/row/EditPathRow";
import DeleteConfirmButton from "@/shared/components/ui/DeleteConfirmButton";
import { toOrdinal } from "@/shared/utils";

type ScoreEntry = { scoreId: number; score: number; percentage: number; isFailed: boolean };

type MatchTableProps = {
  match: Match;
  allMatches: Match[];
  maxPlayersPerMatch: number;
  controls: boolean;
  editMode: boolean;
  highlightedMatchId: number | null;
  onHighlightMatch: (id: number | null) => void;
  pendingTargetPaths: (number | null)[];
  onPendingTargetPathChange: (index: number, value: number | null) => void;
  onDeleteSong: (songId: number) => void;
  onDeletePlayer: (entrantId: number) => void;
  onOpenAddStanding: (playerId: number, songId: number, playerName: string, songTitle: string) => void;
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

export default function MatchTable({
  match,
  allMatches,
  maxPlayersPerMatch,
  controls,
  editMode,
  highlightedMatchId,
  onHighlightMatch,
  pendingTargetPaths,
  onPendingTargetPathChange,
  onDeleteSong,
  onDeletePlayer,
  onOpenAddStanding,
  onOpenEditStanding,
  onDeleteStanding,
}: MatchTableProps) {
  const [tooltip, setTooltip] = useState<{ roundId: number; title: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!tooltip) return;
    const close = () => setTooltip(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("click", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("click", close);
    };
  }, [tooltip]);

  const scoreTable: Record<string, ScoreEntry> = {};
  match.rounds.forEach((round) => {
    (round.standings ?? []).forEach((standing) => {
      const key = `${standing.score.player.id}-${round.song.id}`;
      scoreTable[key] = {
        scoreId: standing.score.id,
        score: standing.points,
        percentage: Number(standing.score.percentage),
        isFailed: standing.score.isFailed,
      };
    });
  });

  const getTotalPoints = (playerId: number) =>
    match.rounds
      .map((round) => (round.standings ?? []).find((s) => s.score.player.id === playerId))
      .reduce((acc, standing) => acc + (standing?.points ?? 0), 0);

  const matchPlayers = entrantPlayers(match.entrants);
  const entrantIdByPlayerId = new Map(
    (match.entrants ?? [])
      .map((entrant) => {
        const player = entrant.participants?.[0]?.player;
        return player ? [player.id, entrant.id] as const : null;
      })
      .filter((entry): entry is readonly [number, number] => Boolean(entry)),
  );
  const sortedPlayers = [...matchPlayers].sort(
    (a, b) => getTotalPoints(b.id) - getTotalPoints(a.id),
  );
  const sortedMatchResults = [...(match.matchResult?.playerPoints ?? [])].sort(
    (a, b) => b.points - a.points || a.playerId - b.playerId,
  );
  const routedPlayerIds = new Set(
    sortedMatchResults
      .map((result, index) => ({ result, targetMatchId: match.targetPaths?.[index] ?? 0 }))
      .filter(({ targetMatchId }) => targetMatchId > 0)
      .map(({ result }) => result.playerId),
  );
  const routeByPlayerId = new Map(
    sortedMatchResults
      .map((result, index) => {
        const targetMatchId = match.targetPaths?.[index] ?? 0;
        if (targetMatchId <= 0) {
          return [result.playerId, null] as const;
        }
        const targetMatchName = allMatches.find((candidate) => candidate.id === targetMatchId)?.name ?? String(targetMatchId);
        return [result.playerId, targetMatchName] as const;
      }),
  );

  const sourcePaths = match.sourcePaths ?? [];
  const hasContent = sortedPlayers.length > 0 || sourcePaths.length > 0 || sortedMatchResults.length > 0;
  const canEditMatchContent = controls && (match.state ?? (match.matchResult ? "Completed" : "NotActive")) !== "Completed";

  // colSpan for single-cell rows (PathRow, EditPathRow, empty message)
  const totalCols = editMode ? 1 : Math.max(2, match.rounds.length + 2);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full text-sm border-collapse">
          {!editMode && match.rounds.length > 0 && (
            <thead>
              <tr className="bg-primary-dark text-white">
                <th className="px-3 py-2.5 text-left font-semibold w-[120px] sm:w-[160px]">Player</th>
                {match.rounds.map((round, idx) => {
                  const roundHasStandings = (round.standings ?? []).length > 0;
                  return (
                    <th key={round.song.id} className="px-1 sm:px-3 py-2.5 text-center font-semibold min-w-[70px] sm:min-w-[130px]">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="sm:hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (tooltip?.roundId === round.song.id) {
                                setTooltip(null);
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setTooltip({ roundId: round.song.id, title: round.song.title, x: rect.left + rect.width / 2, y: rect.top - 8 });
                              }
                            }}
                            className="font-semibold px-1"
                          >
                            {idx + 1}
                          </button>
                        </div>
                        <span className="hidden sm:inline truncate max-w-[110px]" title={round.song.title}>
                          {round.song.title}
                        </span>
                        {canEditMatchContent && !roundHasStandings && (
                          <>
                            <DeleteConfirmButton
                              onConfirm={() => onDeleteSong(round.song.id)}
                              title="Remove song"
                              className="shrink-0"
                              iconClassName="text-xs"
                              confirmMessage={`Remove song "${round.song.title}" from this match?`}
                              confirmText="Remove"
                            />
                          </>
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="px-1 sm:px-3 py-2.5 text-center font-semibold w-[48px] sm:w-[72px]">Pts</th>
              </tr>
            </thead>
          )}

          <tbody>
            {!hasContent && !editMode && (
              <tr>
                <td colSpan={totalCols} className="px-3 py-6 text-center text-gray-400 text-sm">
                  No match data available
                </td>
              </tr>
            )}

            {!editMode && sourcePaths.flatMap((sourceId) => {
              const sourceMatch = allMatches.find((m) => m.id === sourceId);
              const name = sourceMatch?.name ?? String(sourceId);
              const isSelected = highlightedMatchId === sourceId;
              // Find ALL rank positions in sourceMatch.targetPaths that point to this match
              const positions = (sourceMatch?.targetPaths ?? [])
                .map((id, idx) => ({ id, idx }))
                .filter(({ id }) => id === match.id)
                .map(({ idx }) => idx + 1);

              // Fallback: if no positions found, still show one row
              const rows = positions.length > 0 ? positions : [1];

              const isSourceComplete = Boolean(sourceMatch?.matchResult);
              if (isSourceComplete) return [];

              return rows.map((pos) => (
                <PathRow
                  key={`${sourceId}-${pos}`}
                  ordinalLabel={toOrdinal(pos)}
                  sourceMatchName={name}
                  colSpan={totalCols}
                  isSelected={isSelected}
                  onToggle={() => onHighlightMatch(isSelected ? null : sourceId)}
                />
              ));
            })}

            {!editMode && sortedPlayers.map((player, i) => (
              <MatchRow
                key={player.id}
                match={match}
                player={player}
                rank={i}
                controls={canEditMatchContent}
                scoreTable={scoreTable}
                highlightRoute={routedPlayerIds.has(player.id)}
                routeMatchName={routeByPlayerId.get(player.id) ?? null}
                onDeletePlayer={(playerId) => {
                  const entrantId = entrantIdByPlayerId.get(playerId);
                  if (entrantId) onDeletePlayer(entrantId);
                }}
                onOpenAddStanding={onOpenAddStanding}
                onOpenEditStanding={onOpenEditStanding}
                onDeleteStanding={onDeleteStanding}
              />
            ))}

            {editMode && Array.from({ length: maxPlayersPerMatch }).map((_, i) => (
              <EditPathRow
                key={i}
                index={i}
                allMatches={allMatches}
                currentMatchId={match.id}
                value={pendingTargetPaths[i] ?? null}
                onChange={(value) => onPendingTargetPathChange(i, value)}
                onHighlightMatch={onHighlightMatch}
              />
            ))}
          </tbody>
        </table>
      </div>

      {tooltip && createPortal(
        <div
          style={{ position: "fixed", left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)", zIndex: 9999 }}
          className="bg-gray-800 text-white text-xs rounded px-2 py-1.5 whitespace-nowrap shadow-lg pointer-events-none"
        >
          {tooltip.title}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
        </div>,
        document.body,
      )}
    </>
  );
}
