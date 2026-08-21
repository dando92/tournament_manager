import { ReactNode, useEffect, useMemo, useState } from "react";
import { PhaseGroup } from "@/features/division/types/Phase";
import { entrantPlayer } from "@/features/entrant/types/Entrant";
import { Match } from "@/features/match/types/Match";
import { Player } from "@/features/player/types/Player";
import { getCommitBadgeClass, getCommitBadgeLabel, getMatchCommitState } from "@/features/match/utils/matchStatus";

type RoundRobinMatchesViewProps = {
  matches: Match[];
  phaseGroup?: PhaseGroup;
  renderMatchCard: (match: Match) => ReactNode;
};

type PlayerStats = {
  player: Player;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  order: number;
};

type PairCell = {
  match: Match | null;
  rowPoints: number;
  columnPoints: number;
  committed: boolean;
};

function getPairKey(leftPlayerId: number, rightPlayerId: number): string {
  return [leftPlayerId, rightPlayerId].sort((left, right) => left - right).join(":");
}

function getMatchPlayers(match: Match): Player[] {
  return (match.entrants ?? [])
    .map(entrantPlayer)
    .filter((player): player is Player => Boolean(player));
}

function getPlayerPoints(match: Match, playerId: number): number {
  return match.matchResult?.playerPoints?.find((entry) => entry.playerId === playerId)?.points ?? 0;
}

function getCellResultClass(cell: PairCell): string {
  if (!cell.committed || cell.rowPoints === cell.columnPoints) {
    return "border-gray-200 bg-gray-100 text-gray-700";
  }

  return cell.rowPoints > cell.columnPoints
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-red-200 bg-red-50 text-red-700";
}

export default function RoundRobinMatchesView({
  matches,
  phaseGroup,
  renderMatchCard,
}: RoundRobinMatchesViewProps) {
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);

  const basePlayers = useMemo(() => {
    const playersById = new Map<number, { player: Player; order: number }>();
    const phaseGroupEntrants = phaseGroup?.entrants ?? [];

    phaseGroupEntrants.forEach((entry, index) => {
      const player = entrantPlayer(entry.entrant);
      if (player && !playersById.has(player.id)) {
        playersById.set(player.id, { player, order: index });
      }
    });

    matches.forEach((match) => {
      getMatchPlayers(match).forEach((player) => {
        if (!playersById.has(player.id)) {
          playersById.set(player.id, { player, order: playersById.size });
        }
      });
    });

    return Array.from(playersById.values());
  }, [matches, phaseGroup?.entrants]);

  const matchByPairKey = useMemo(() => {
    const pairs = new Map<string, Match>();

    matches.forEach((match) => {
      const players = getMatchPlayers(match);
      if (players.length !== 2) return;

      const key = getPairKey(players[0].id, players[1].id);
      if (!pairs.has(key)) {
        pairs.set(key, match);
      }
    });

    return pairs;
  }, [matches]);

  const statsByPlayerId = useMemo(() => {
    const stats = new Map<number, PlayerStats>();
    basePlayers.forEach(({ player, order }) => {
      stats.set(player.id, {
        player,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        order,
      });
    });

    matches.forEach((match) => {
      if (!match.matchResult) return;

      const players = getMatchPlayers(match);
      if (players.length !== 2) return;

      const left = players[0];
      const right = players[1];
      const leftPoints = getPlayerPoints(match, left.id);
      const rightPoints = getPlayerPoints(match, right.id);
      const leftStats = stats.get(left.id);
      const rightStats = stats.get(right.id);
      if (!leftStats || !rightStats) return;

      leftStats.pointsFor += leftPoints;
      leftStats.pointsAgainst += rightPoints;
      rightStats.pointsFor += rightPoints;
      rightStats.pointsAgainst += leftPoints;

      if (leftPoints > rightPoints) {
        leftStats.wins += 1;
        rightStats.losses += 1;
      } else if (rightPoints > leftPoints) {
        rightStats.wins += 1;
        leftStats.losses += 1;
      }
    });

    return stats;
  }, [basePlayers, matches]);

  const orderedPlayers = useMemo(
    () =>
      basePlayers
        .map(({ player }) => statsByPlayerId.get(player.id))
        .filter((stats): stats is PlayerStats => Boolean(stats))
        .sort((left, right) => right.wins - left.wins || left.order - right.order)
        .map((stats) => stats.player),
    [basePlayers, statsByPlayerId],
  );

  const selectedMatch = matches.find((match) => match.id === selectedMatchId) ?? null;

  useEffect(() => {
    if (!selectedMatchId) return;
    if (!matches.some((match) => match.id === selectedMatchId)) {
      setSelectedMatchId(null);
    }
  }, [matches, selectedMatchId]);

  function getCell(rowPlayer: Player, columnPlayer: Player): PairCell {
    const match = matchByPairKey.get(getPairKey(rowPlayer.id, columnPlayer.id)) ?? null;
    if (!match) {
      return { match: null, rowPoints: 0, columnPoints: 0, committed: false };
    }

    return {
      match,
      rowPoints: getPlayerPoints(match, rowPlayer.id),
      columnPoints: getPlayerPoints(match, columnPlayer.id),
      committed: Boolean(match.matchResult),
    };
  }

  if (orderedPlayers.length === 0) {
    return <p className="text-center text-gray-500 text-sm py-8">No round robin players yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md bg-white">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-2 py-2 text-left text-xs font-semibold text-gray-700 sm:px-3 sm:py-3 sm:text-sm">
                <span className="sr-only">Players</span>
              </th>
              {orderedPlayers.map((player) => (
                <th key={player.id} className="min-w-[92px] px-2 py-2 text-center text-xs font-semibold text-gray-800 sm:min-w-[160px] sm:px-3 sm:py-3 sm:text-sm">
                  {player.playerName}
                </th>
              ))}
              <th className="min-w-[72px] px-2 py-2 text-center text-xs font-semibold text-gray-700 sm:min-w-[110px] sm:px-3 sm:py-3 sm:text-sm">
                <span className="sr-only">Final results</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {orderedPlayers.map((rowPlayer) => {
              const rowStats = statsByPlayerId.get(rowPlayer.id);

              return (
                <tr key={rowPlayer.id}>
                  <th className="sticky left-0 z-10 max-w-[96px] truncate bg-white px-2 py-2 text-left text-xs font-semibold text-gray-800 sm:max-w-none sm:px-3 sm:py-3 sm:text-sm">
                    {rowPlayer.playerName}
                  </th>
                  {orderedPlayers.map((columnPlayer) => {
                    if (rowPlayer.id === columnPlayer.id) {
                      return (
                        <td key={columnPlayer.id} className="h-16 min-w-[92px] bg-gray-200 sm:h-24 sm:min-w-[160px]" />
                      );
                    }

                    const cell = getCell(rowPlayer, columnPlayer);
                    const isSelected = Boolean(cell.match && cell.match.id === selectedMatchId);

                    if (!cell.match) {
                      return (
                        <td key={columnPlayer.id} className="h-16 min-w-[92px] bg-gray-100 px-1.5 py-1 text-center text-[10px] font-medium leading-tight text-gray-500 sm:h-24 sm:min-w-[160px] sm:px-3 sm:py-2 sm:text-xs">
                          No match available
                        </td>
                      );
                    }

                    const commitState = getMatchCommitState(cell.match);

                    return (
                      <td key={columnPlayer.id} className="h-16 min-w-[92px] p-1 sm:h-24 sm:min-w-[160px] sm:p-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedMatchId((current) => current === cell.match?.id ? null : cell.match?.id ?? null)
                          }
                          className={`flex h-full w-full flex-col items-center justify-center gap-1 rounded border px-1 py-1 text-center transition-colors sm:gap-2 sm:px-2 sm:py-2 ${getCellResultClass(cell)} ${
                            isSelected ? "border-brand-400 ring-2 ring-brand-300" : "hover:border-brand-300"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-center gap-0.5 sm:gap-1">
                            <span className={`rounded border px-1 py-0 text-[8px] font-semibold leading-4 sm:px-1.5 sm:py-0.5 sm:text-[10px] ${
                              cell.match.active ? "border-brand-200 bg-brand-50 text-brand-700" : "border-gray-200 bg-gray-50 text-gray-700"
                            }`}>
                              {cell.match.active ? "Active" : "Not active"}
                            </span>
                            <span className={`rounded border px-1 py-0 text-[8px] font-semibold leading-4 sm:px-1.5 sm:py-0.5 sm:text-[10px] ${getCommitBadgeClass(commitState)}`}>
                              {getCommitBadgeLabel(commitState)}
                            </span>
                          </div>
                          <span className="text-sm font-bold sm:text-base">
                            {cell.rowPoints} - {cell.columnPoints}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center sm:px-3 sm:py-3">
                    <div className="text-sm font-bold text-gray-900 sm:text-base">
                      {rowStats?.wins ?? 0} - {rowStats?.losses ?? 0}
                    </div>
                    <div className="mt-0.5 text-xs font-semibold text-gray-500 sm:mt-1 sm:text-sm">
                      {rowStats?.pointsFor ?? 0} - {rowStats?.pointsAgainst ?? 0}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selectedMatch && renderMatchCard(selectedMatch)}
    </div>
  );
}
