import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AdvancementCompetitionKind, Match, MatchHighlight } from "@/features/match/types/Match";
import { Division } from "@/features/division/types/Division";
import { entrantPlayers } from "@/features/entrant/types/Entrant";
import MatchRow from "@/features/match/components/row/MatchRow";
import PathRow from "@/features/match/components/row/PathRow";
import DeleteConfirmButton from "@/shared/components/ui/DeleteConfirmButton";
import { toOrdinal } from "@/shared/utils";

type ScoreEntry = { scoreId: number; score: number; percentage: number; isFailed: boolean };

type MatchTableProps = {
  match: Match;
  division: Division;
  allMatches: Match[];
  controls: boolean;
  highlight: MatchHighlight;
  onHighlight: (highlight: MatchHighlight) => void;
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
  division,
  allMatches,
  controls,
  highlight,
  onHighlight,
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
  const routeByPlayerId = new Map(
    sortedMatchResults
      .map((result, index) => {
        const route = (match.advancementRules ?? []).find(
          (rule) => rule.sourceKind === "match" && rule.sourceId === match.id && rule.sourcePlacement === index + 1,
        );
        if (!route || route.targetKind !== "match") {
          return [result.playerId, null] as const;
        }
        return [result.playerId, route.targetId] as const;
      }),
  );

  const incomingRules = (match.advancementRules ?? []).filter(
    (rule) => rule.targetKind === "match" && rule.targetId === match.id,
  );
  const sourceKeys = Array.from(new Set(incomingRules.map((rule) => `${rule.sourceKind}:${rule.sourceId}`)));
  const hasContent = sortedPlayers.length > 0 || incomingRules.length > 0 || sortedMatchResults.length > 0;
  const canEditMatchContent = controls && (match.state ?? (match.matchResult ? "Completed" : "NotActive")) !== "Completed";

  const totalCols = Math.max(3, match.rounds.length + 3);
  const phaseGroups = (division.phases ?? []).flatMap((phase) => phase.phaseGroups ?? []);
  const getPhaseGroupName = (phaseGroupId: number) => phaseGroups.find((phaseGroup) => phaseGroup.id === phaseGroupId)?.name ?? `Phase group ${phaseGroupId}`;
  const getHighlightForTarget = (targetKind: AdvancementCompetitionKind, targetId: number): MatchHighlight => {
    if (targetKind === "match") {
      const targetMatch = allMatches.find((candidate) => candidate.id === targetId);
      return { matchId: targetId, phaseGroupId: targetMatch?.phaseGroupId ?? null };
    }
    return { matchId: null, phaseGroupId: targetId };
  };
  const isHighlightSelected = (target: MatchHighlight) =>
    highlight.matchId === target.matchId && highlight.phaseGroupId === target.phaseGroupId;
  const toggleHighlight = (target: MatchHighlight) => {
    onHighlight(isHighlightSelected(target) ? { matchId: null, phaseGroupId: null } : target);
  };

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full text-sm border-collapse">
          {match.rounds.length > 0 && (
            <thead>
              <tr className="bg-primary-dark text-white">
                <th className="px-2 py-2.5 w-8" />
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
            {!hasContent && (
              <tr>
                <td colSpan={totalCols} className="px-3 py-6 text-center text-gray-400 text-sm">
                  No match data available
                </td>
              </tr>
            )}

            {sourceKeys.flatMap((sourceKey) => {
              const [sourceKind, rawSourceId] = sourceKey.split(":");
              const typedSourceKind = sourceKind as AdvancementCompetitionKind;
              const sourceId = Number(rawSourceId);
              const sourceMatch = typedSourceKind === "match" ? allMatches.find((m) => m.id === sourceId) : null;
              const sourcePhaseGroup = typedSourceKind === "phase_group"
                ? phaseGroups.find((phaseGroup) => phaseGroup.id === sourceId) ?? null
                : null;
              const name = sourceMatch?.name ?? sourcePhaseGroup?.name ?? (
                typedSourceKind === "match" ? `Match ${sourceId}` : `Phase group ${sourceId}`
              );
              const sourceHighlight = getHighlightForTarget(typedSourceKind, sourceId);
              const isSelected = isHighlightSelected(sourceHighlight);
              const positions = incomingRules
                .filter((rule) => rule.sourceKind === typedSourceKind && rule.sourceId === sourceId)
                .map((rule) => rule.sourcePlacement);

              // Fallback: if no positions found, still show one row
              const rows = positions.length > 0 ? positions : [1];

              const isSourceComplete = typedSourceKind === "match"
                ? Boolean(sourceMatch?.matchResult)
                : sourcePhaseGroup?.state === "completed";
              if (isSourceComplete) return [];

              return rows.map((pos) => (
                <PathRow
                  key={`${typedSourceKind}-${sourceId}-${pos}`}
                  ordinalLabel={toOrdinal(pos)}
                  sourceMatchName={name}
                  colSpan={totalCols}
                  isSelected={isSelected}
                  onToggle={() => toggleHighlight(sourceHighlight)}
                />
              ));
            })}

            {sortedPlayers.map((player) => (
              (() => {
                const routeTargetMatchId = routeByPlayerId.get(player.id) ?? null;
                const routeTargetMatch = routeTargetMatchId ? allMatches.find((candidate) => candidate.id === routeTargetMatchId) : null;
                const routeTargetHighlight: MatchHighlight | null = routeTargetMatchId
                  ? { matchId: routeTargetMatchId, phaseGroupId: routeTargetMatch?.phaseGroupId ?? null }
                  : null;
                return (
                  <MatchRow
                    key={player.id}
                    match={match}
                    player={player}
                    controls={canEditMatchContent}
                    scoreTable={scoreTable}
                    hasRoute={routeTargetMatchId !== null}
                    isRouteSelected={routeTargetHighlight !== null && isHighlightSelected(routeTargetHighlight)}
                    routeTargetMatchId={routeTargetMatchId}
                    routeTargetLabel={routeTargetMatch ? `${getPhaseGroupName(routeTargetMatch.phaseGroupId)} / ${routeTargetMatch.name}` : undefined}
                    canClearRouteHighlight={highlight.matchId !== null || highlight.phaseGroupId !== null}
                    onToggleRouteHighlight={() => {
                      if (routeTargetHighlight) toggleHighlight(routeTargetHighlight);
                    }}
                    onClearRouteHighlight={() => onHighlight({ matchId: null, phaseGroupId: null })}
                    onDeletePlayer={(playerId) => {
                      const entrantId = entrantIdByPlayerId.get(playerId);
                      if (entrantId) onDeletePlayer(entrantId);
                    }}
                    onOpenAddStanding={onOpenAddStanding}
                    onOpenEditStanding={onOpenEditStanding}
                    onDeleteStanding={onDeleteStanding}
                  />
                );
              })()
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
