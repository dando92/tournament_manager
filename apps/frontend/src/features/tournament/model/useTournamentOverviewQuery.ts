import { useQuery } from "@tanstack/react-query";
import { getTournamentOverview } from "@/features/tournament/api/tournament.api";
import { tournamentKeys } from "@/features/tournament/api/tournament.keys";
import { TournamentOverview } from "@/features/tournament/model/types";
import { TournamentDivisionOption } from "@/features/tournament/model/types";

/**
 * The tournament's whole structure in one request.
 *
 * Divisions, phases and pools all come back together, which is what lets the
 * sidebar draw the tree without walking the API a level at a time. It is a
 * shared query rather than a fetch per caller so the tree and the pages that
 * need the same list resolve to one request.
 */

export function toDivisionOptions(overview: TournamentOverview): TournamentDivisionOption[] {
  return overview.divisions.map((division) => ({
    id: division.id,
    name: division.name,
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
    queryKey: tournamentKeys.overview(tournamentId ?? 0),
    enabled: tournamentId !== null,
    queryFn: async () => toDivisionOptions(await getTournamentOverview(tournamentId ?? 0)),
  });
}
