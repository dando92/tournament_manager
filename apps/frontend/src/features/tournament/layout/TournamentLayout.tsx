import TournamentManagementModals from "@/features/tournament/components/TournamentManagementModals";
import TournamentPageHeader from "@/features/tournament/components/header/TournamentPageHeader";
import { TournamentLobbiesProvider } from "@/features/tournament/context/TournamentLobbiesContext";
import { TournamentPageContextValue } from "@/features/tournament/context/TournamentPageContext";
import { TournamentPageState } from "@/features/tournament/hooks/useTournamentPage";
import { useTournamentLayout } from "@/features/tournament/hooks/useTournamentLayout";
import { Outlet } from "react-router-dom";

type TournamentLayoutProps = {
  context: TournamentPageContextValue;
  state: TournamentPageState;
};

export default function TournamentLayout({ context, state }: TournamentLayoutProps) {
  const {
    isOverviewPage,
    isLobbiesPage,
    isParticipantsPage,
    isSongsPage,
    isDivisionPhasesPage,
    currentDivisionId,
    currentPhaseId,
    headerSubtitle,
    handleCreatePhase,
    handleCreatePhaseGroup,
    handleGenerateBracket,
  } = useTournamentLayout({ context, state });
  const currentDivision = state.divisions.find((division) => division.id === currentDivisionId);

  const pageContent = (
    <>
      <TournamentPageHeader
        tournamentId={context.tournamentId}
        tournamentName={context.tournamentName}
        headerSubtitle={headerSubtitle}
        controls={context.controls}
        isOverviewPage={isOverviewPage}
        isSongsPage={isSongsPage}
        isParticipantsPage={isParticipantsPage}
        isLobbiesPage={isLobbiesPage}
        isDivisionPhasesPage={isDivisionPhasesPage}
        songsVersion={context.songsVersion}
        refreshSongs={context.refreshSongs}
        createMenuOpen={state.createMenuOpen}
        setCreateMenuOpen={state.setCreateMenuOpen}
        hasDivisions={state.divisions.length > 0}
        hasCurrentDivisionPhases={(currentDivision?.phases.length ?? 0) > 0}
        hasStartggApiKey={context.hasStartggApiKey}
        onCreateDivision={() => state.setCreateDivisionOpen(true)}
        onGenerateBracket={() => state.setGenerateBracketOpen(true)}
        onCreatePhase={() => state.setCreatePhaseOpen(true)}
        onCreatePhaseGroup={() => state.setCreatePhaseGroupOpen(true)}
        onOpenParticipantsManageModal={context.setParticipantsManageModal}
      />

      <Outlet context={context} />
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <TournamentManagementModals
        context={context}
        state={state}
        currentDivisionId={currentDivisionId}
        currentPhaseId={currentPhaseId}
        onCreatePhase={handleCreatePhase}
        onCreatePhaseGroup={handleCreatePhaseGroup}
        onGenerateBracket={handleGenerateBracket}
      />

      {isLobbiesPage ? (
        <TournamentLobbiesProvider tournamentId={context.tournamentId}>
          {pageContent}
        </TournamentLobbiesProvider>
      ) : (
        pageContent
      )}
    </div>
  );
}
