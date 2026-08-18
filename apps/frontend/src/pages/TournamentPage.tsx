import { Navigate, useParams } from "react-router-dom";
import TournamentLayout from "@/features/tournament/layout/TournamentLayout";
import { TournamentUpdatesProvider } from "@/features/tournament/context/TournamentUpdatesContext";
import { useTournamentPageContainer } from "@/features/tournament/hooks/useTournamentPageContainer";
import { getSelectedTournament } from "@/features/tournament/services/recentTournaments";

export default function TournamentPage() {
  const { tournamentId: tidParam } = useParams<{ tournamentId?: string }>();
  const selectedTournamentId = tidParam ? Number(tidParam) : null;

  if (selectedTournamentId === null) {
    const last = getSelectedTournament();
    if (last) {
      return <Navigate to={`/tournament/${last.id}/overview`} replace />;
    }
    return <Navigate to="/" replace />;
  }

  return (
    <TournamentUpdatesProvider tournamentId={selectedTournamentId}>
      <TournamentPageContainer tournamentId={selectedTournamentId} />
    </TournamentUpdatesProvider>
  );
}

function TournamentPageContainer({ tournamentId }: { tournamentId: number }) {
  const { context, state } = useTournamentPageContainer(tournamentId);

  return <TournamentLayout context={context} state={state} />;
}
