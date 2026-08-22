import { Suspense, useMemo } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import TournamentPageHeader from "@/features/tournament/ui/header/TournamentPageHeader";
import { TournamentLobbiesProvider } from "@/features/tournament/model/TournamentLobbiesContext";
import { TournamentPageContextValue } from "@/features/tournament/model/TournamentPageContext";
import { useTournamentPageContainer } from "@/features/tournament/model/useTournamentPageContainer";
import { getSelectedTournament } from "@/shared/lib/recentTournaments";

/**
 * What wraps every tournament destination: the header, and the lobby context
 * for the one page that needs it.
 *
 * The realtime provider used to be mounted here. It now sits in `MainLayout`,
 * above the sidebar as well as the outlet, so the tree's glyphs follow the same
 * live events the pages do. The structural dialogs moved the other way, to sit
 * beside the tree provider, because the tree's context menu is what opens them
 * and the tree outlives any page.
 */
export default function TournamentPage() {
  const { tournamentId: tidParam } = useParams<{ tournamentId?: string }>();
  const selectedTournamentId = tidParam ? Number(tidParam) : null;

  if (selectedTournamentId === null) {
    const last = getSelectedTournament();
    return <Navigate to={last ? `/tournament/${last.id}/overview` : "/"} replace />;
  }

  return <TournamentShell tournamentId={selectedTournamentId} />;
}

function TournamentShell({ tournamentId }: { tournamentId: number }) {
  const { context } = useTournamentPageContainer(tournamentId);
  return <TournamentFrame context={context} />;
}

function TournamentFrame({ context }: { context: TournamentPageContextValue }) {
  const location = useLocation();
  const { tournamentId } = context;

  const page = useMemo(() => {
    const at = (key: string) => location.pathname === `/tournament/${tournamentId}/${key}`;
    return {
      isSongsPage: at("songs"),
      isParticipantsPage: at("participants"),
      isLobbiesPage: at("lobbies"),
    };
  }, [location.pathname, tournamentId]);

  const content = (
    <>
      <TournamentPageHeader
        tournamentId={tournamentId}
        tournamentName={context.tournamentName}
        controls={context.controls}
        isSongsPage={page.isSongsPage}
        isParticipantsPage={page.isParticipantsPage}
        isLobbiesPage={page.isLobbiesPage}
        songsVersion={context.songsVersion}
        refreshSongs={context.refreshSongs}
        onOpenParticipantsManageModal={context.setParticipantsManageModal}
      />

      <Suspense fallback={null}>
        <Outlet context={context} />
      </Suspense>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      {page.isLobbiesPage ? (
        <TournamentLobbiesProvider tournamentId={tournamentId}>{content}</TournamentLobbiesProvider>
      ) : (
        content
      )}
    </div>
  );
}
