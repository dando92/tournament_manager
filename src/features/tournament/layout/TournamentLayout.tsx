import TournamentManagementModals from "@/features/tournament/components/TournamentManagementModals";
import TournamentPageHeader from "@/features/tournament/components/header/TournamentPageHeader";
import { TournamentPageContextValue } from "@/features/tournament/context/TournamentPageContext";
import { TournamentPageState } from "@/features/tournament/hooks/useTournamentPage";
import { useTournamentLayout } from "@/features/tournament/hooks/useTournamentLayout";
import { Outlet } from "react-router-dom";

type TournamentLayoutProps = {
  context: TournamentPageContextValue;
  state: TournamentPageState;
};

export default function TournamentLayout({ context, state }: TournamentLayoutProps) {
  const { isOverviewPage, isLobbiesPage, isParticipantsPage, isSongsPage, isDivisionPhasesPage, currentDivisionId, headerSubtitle, handleCreatePhase, handleGenerateBracket } =
    useTournamentLayout({ context, state });

  return (
    <div className="flex flex-col gap-4">
      <TournamentManagementModals
        context={context}
        state={state}
        currentDivisionId={currentDivisionId}
        onCreatePhase={handleCreatePhase}
        onGenerateBracket={handleGenerateBracket}
      />

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
        syncstartUrl={context.syncstartUrl}
        setSyncstartUrl={context.setSyncstartUrl}
        songsVersion={context.songsVersion}
        refreshSongs={context.refreshSongs}
        createMenuOpen={state.createMenuOpen}
        setCreateMenuOpen={state.setCreateMenuOpen}
        hasDivisions={state.divisions.length > 0}
        onCreateDivision={() => state.setCreateDivisionOpen(true)}
        onGenerateBracket={() => state.setGenerateBracketOpen(true)}
        onCreatePhase={() => state.setCreatePhaseOpen(true)}
        onOpenParticipantsManageModal={context.setParticipantsManageModal}
      />

      <Outlet context={context} />
    </div>
  );
}
