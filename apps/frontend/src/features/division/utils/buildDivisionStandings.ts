import { Division } from "@/features/division/types/Division";

export type DivisionStandingRow = {
  id: number;
  playerName: string;
  points: number;
  songsPlayed: number;
};

export function buildDivisionStandings(division: Division): DivisionStandingRow[] {
  const playerTotals = new Map<number, DivisionStandingRow>();

  division.phases.forEach((phase) => {
    phase.matches?.forEach((match) => {
      match.rounds?.forEach((round) => {
        round.standings?.forEach((standing) => {
          const player = standing.score.player;
          const current = playerTotals.get(player.id) ?? {
            id: player.id,
            playerName: player.playerName,
            points: 0,
            songsPlayed: 0,
          };
          current.points += standing.points ?? 0;
          current.songsPlayed += 1;
          playerTotals.set(player.id, current);
        });
      });
    });
  });

  return Array.from(playerTotals.values()).sort((a, b) =>
    b.points - a.points || b.songsPlayed - a.songsPlayed || a.playerName.localeCompare(b.playerName),
  );
}
