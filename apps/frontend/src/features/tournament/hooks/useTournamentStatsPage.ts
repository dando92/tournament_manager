import { useMemo, useState } from "react";
import { Division } from "@/features/division/types/Division";

export type PlayerScoreRow = {
  id: string;
  playerId: number;
  playerName: string;
  divisionName: string;
  phaseName: string;
  matchName: string;
  songTitle: string;
  songArtist?: string;
  percentage: number;
  points: number;
  isFailed: boolean;
};

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function scoreBadgeClass(percentage: number, isFailed: boolean): string {
  if (isFailed) return "bg-red-100 text-red-700 border-red-200";
  if (percentage >= 99) return "bg-purple-100 text-purple-800 border-purple-200";
  if (percentage >= 95) return "bg-blue-100 text-blue-800 border-blue-200";
  if (percentage >= 90) return "bg-green-100 text-green-800 border-green-200";
  if (percentage >= 80) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

export function useTournamentStatsPage(divisions: Division[]) {
  const [search, setSearch] = useState("");
  const [expandedPlayers, setExpandedPlayers] = useState<Set<number>>(new Set());

  const playerScores = useMemo<PlayerScoreRow[]>(() => {
    return divisions.flatMap((division) =>
      (division.phases ?? []).flatMap((phase) =>
        (phase.matches ?? []).flatMap((match) =>
          (match.rounds ?? []).flatMap((round) =>
            (round.standings ?? []).map((standing) => ({
              id: `${match.id}-${round.id}-${standing.id}`,
              playerId: standing.score.player.id,
              playerName: standing.score.player.playerName,
              divisionName: division.name,
              phaseName: phase.name,
              matchName: match.name,
              songTitle: round.song.title,
              songArtist: round.song.artist,
              percentage: toNumber(standing.score.percentage),
              points: toNumber(standing.points),
              isFailed: standing.score.isFailed,
            })),
          ),
        ),
      ),
    );
  }, [divisions]);

  const groupedPlayers = useMemo(() => {
    const lowerSearch = search.toLowerCase().trim();
    const map = new Map<number, { playerId: number; playerName: string; rows: PlayerScoreRow[] }>();

    for (const row of playerScores) {
      if (lowerSearch && !row.playerName.toLowerCase().includes(lowerSearch)) continue;
      const existing = map.get(row.playerId) ?? {
        playerId: row.playerId,
        playerName: row.playerName,
        rows: [],
      };
      existing.rows.push(row);
      map.set(row.playerId, existing);
    }

    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        rows: entry.rows.sort((a, b) =>
          a.isFailed !== b.isFailed
            ? (a.isFailed ? 1 : -1)
            : b.percentage - a.percentage ||
              b.points - a.points ||
              a.songTitle.localeCompare(b.songTitle),
        ),
        averageScore:
          entry.rows.reduce((sum, row) => sum + row.percentage, 0) /
          Math.max(entry.rows.length, 1),
      }))
      .sort((a, b) => a.playerName.localeCompare(b.playerName));
  }, [playerScores, search]);

  function togglePlayer(playerId: number) {
    setExpandedPlayers((prev) => {
      const next = new Set(prev);
      next.has(playerId) ? next.delete(playerId) : next.add(playerId);
      return next;
    });
  }

  return {
    search,
    setSearch,
    expandedPlayers,
    playerScores,
    groupedPlayers,
    togglePlayer,
  };
}
