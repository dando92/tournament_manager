import { Suspense, useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";
import TournamentPageHeader from "@/features/tournament/components/header/TournamentPageHeader";
import { TournamentLobbiesProvider } from "@/features/tournament/context/TournamentLobbiesContext";
import { TournamentPageContextValue } from "@/features/tournament/context/TournamentPageContext";

/**
 * What wraps every tournament destination: the header, and the lobby context
 * for the one page that needs it.
 *
 * The structural dialogs used to be mounted here. They now live beside the
 * tree provider, because the tree's context menu is what opens them and the
 * tree outlives any page.
 */
export default function TournamentLayout({ context }: { context: TournamentPageContextValue }) {
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
