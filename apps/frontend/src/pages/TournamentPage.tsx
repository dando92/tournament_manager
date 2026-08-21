import { Navigate, useParams } from "react-router-dom";
import TournamentLayout from "@/features/tournament/layout/TournamentLayout";
import { useTournamentPageContainer } from "@/features/tournament/hooks/useTournamentPageContainer";
import { getSelectedTournament } from "@/features/tournament/services/recentTournaments";

/**
 * The realtime provider used to be mounted here. It now sits in `MainLayout`,
 * above the sidebar as well as the outlet, so the tree's glyphs follow the same
 * live events the pages do.
 */
export default function TournamentPage() {
  const { tournamentId: tidParam } = useParams<{ tournamentId?: string }>();
  const selectedTournamentId = tidParam ? Number(tidParam) : null;

  if (selectedTournamentId === null) {
    const last = getSelectedTournament();
    return <Navigate to={last ? `/tournament/${last.id}/overview` : "/"} replace />;
  }

  return <TournamentPageContainer tournamentId={selectedTournamentId} />;
}

function TournamentPageContainer({ tournamentId }: { tournamentId: number }) {
  const { context } = useTournamentPageContainer(tournamentId);
  return <TournamentLayout context={context} />;
}
