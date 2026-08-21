import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { TournamentOverview } from "@/features/tournament/types/TournamentOverview";
import { TournamentDivisionOption } from "@/features/tournament/types/TournamentDivisionOption";

/**
 * The tournament's whole structure in one request.
 *
 * Divisions, phases and pools all come back together, which is what lets the
 * sidebar draw the tree without walking the API a level at a time. It is a
 * shared query rather than a fetch per caller so the tree and the pages that
 * need the same list resolve to one request.
 */

export function tournamentOverviewKey(tournamentId: number) {
  return ["tournament-overview", tournamentId] as const;
}

export function toDivisionOptions(overview: TournamentOverview): TournamentDivisionOption[] {
  return overview.divisions.map((division) => ({
    id: division.id,
    name: division.name,
    entrants: division.entrants,
    phases: division.phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      matchCount: phase.matchCount,
      phaseGroups: phase.phaseGroups ?? [],
    })),
  }));
}

export function useTournamentOverviewQuery(tournamentId: number | null) {
  return useQuery({
    queryKey: tournamentOverviewKey(tournamentId ?? 0),
    enabled: tournamentId !== null,
    queryFn: async () => {
      const response = await axios.get<TournamentOverview>(`tournaments/${tournamentId}/overview`);
      return toDivisionOptions(response.data);
    },
  });
}
