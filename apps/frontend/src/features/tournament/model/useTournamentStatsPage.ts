import { useMemo, useState } from "react";
import { TournamentStatsDivision } from "@/features/tournament/model/types";

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

/**
 * Ranks a score into one of the ordinal score bands. The `score` scale is a
 * domain scale, not a semantic one: a band says how good a result is, it never
 * reports the state of the application.
 */
export function scoreBadgeClass(percentage: number, isFailed: boolean): string {
  if (isFailed) return "bg-score-failed/10 text-score-failed border-score-failed/25";
  if (percentage >= 99) return "bg-score-4/10 text-score-4 border-score-4/25";
  if (percentage >= 95) return "bg-score-3/10 text-score-3 border-score-3/25";
  if (percentage >= 90) return "bg-score-2/10 text-score-2 border-score-2/25";
  if (percentage >= 80) return "bg-score-1/10 text-score-1 border-score-1/25";
  return "bg-score-base/10 text-score-base border-score-base/25";
}

export function useTournamentStatsPage(divisions: TournamentStatsDivision[]) {
  const [search, setSearch] = useState("");
  const [expandedPlayers, setExpandedPlayers] = useState<Set<number>>(new Set());

  const playerScores = useMemo<PlayerScoreRow[]>(() => {
    return divisions.flatMap((division) =>
      (division.phases ?? []).flatMap((phase) =>
        (phase.matches ?? []).flatMap((match) =>
          /* A hand-scored round has no song and no score, so it has nothing
             to say in a table of songs a player ran. */
          (match.rounds ?? []).flatMap((round) => {
            const song = round.song;
            if (!song) return [];

            return (round.standings ?? []).flatMap((standing) => {
              const score = standing.score;
              if (!score) return [];

              return [{
                id: `${match.id}-${round.id}-${standing.id}`,
                playerId: standing.player.id,
                playerName: standing.player.playerName,
                divisionName: division.name,
                phaseName: phase.name,
                matchName: match.name,
                songTitle: song.title,
                songArtist: song.artist,
                percentage: toNumber(score.percentage),
                points: toNumber(standing.points),
                isFailed: score.isFailed,
              }];
            });
          }),
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
