import type { Dispatch, SetStateAction } from "react";
import { ParticipantsManageModal } from "@/features/tournament/context/TournamentPageContext";
import TournamentHeaderCreateMenu from "@/features/tournament/components/header/TournamentHeaderCreateMenu";
import TournamentHeaderLobbyManageMenu from "@/features/tournament/components/header/TournamentHeaderLobbyManageMenu";
import TournamentHeaderParticipantsManageMenu from "@/features/tournament/components/header/TournamentHeaderParticipantsManageMenu";
import TournamentHeaderSongsManageMenu from "@/features/tournament/components/header/TournamentHeaderSongsManageMenu";

type TournamentPageHeaderProps = {
  tournamentId: number;
  tournamentName: string;
  headerSubtitle: string;
  controls: boolean;
  isOverviewPage: boolean;
  isSongsPage: boolean;
  isParticipantsPage: boolean;
  isLobbiesPage: boolean;
  isDivisionPhasesPage: boolean;
  syncstartUrl: string;
  setSyncstartUrl: Dispatch<SetStateAction<string>>;
  songsVersion: number;
  refreshSongs: () => void;
  createMenuOpen: boolean;
  setCreateMenuOpen: Dispatch<SetStateAction<boolean>>;
  hasDivisions: boolean;
  hasCurrentDivisionPhases: boolean;
  onCreateDivision: () => void;
  onGenerateBracket: () => void;
  onCreatePhase: () => void;
  onCreatePhaseGroup: () => void;
  onOpenParticipantsManageModal: Dispatch<SetStateAction<ParticipantsManageModal>>;
};

export default function TournamentPageHeader({
  tournamentId,
  tournamentName,
  headerSubtitle,
  controls,
  isOverviewPage,
  isSongsPage,
  isParticipantsPage,
  isLobbiesPage,
  isDivisionPhasesPage,
  syncstartUrl,
  setSyncstartUrl,
  songsVersion,
  refreshSongs,
  createMenuOpen,
  setCreateMenuOpen,
  hasDivisions,
  hasCurrentDivisionPhases,
  onCreateDivision,
  onGenerateBracket,
  onCreatePhase,
  onCreatePhaseGroup,
  onOpenParticipantsManageModal,
}: TournamentPageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <h1 className="text-2xl font-black text-gray-900">{tournamentName}</h1>
        <p className="text-sm text-gray-500">{headerSubtitle}</p>
      </div>

      {controls && (
        <div className="flex items-center gap-2 ml-auto">
          {(isOverviewPage || isDivisionPhasesPage) && (
            <TournamentHeaderCreateMenu
              open={createMenuOpen}
              setOpen={setCreateMenuOpen}
              showCreateDivision={isOverviewPage}
              showCreatePhaseGroup={isDivisionPhasesPage}
              hasDivisions={hasDivisions}
              hasCurrentDivisionPhases={hasCurrentDivisionPhases}
              onCreateDivision={onCreateDivision}
              onGenerateBracket={onGenerateBracket}
              onCreatePhase={onCreatePhase}
              onCreatePhaseGroup={onCreatePhaseGroup}
            />
          )}
          {isSongsPage && (
            <TournamentHeaderSongsManageMenu
              tournamentId={tournamentId}
              songsVersion={songsVersion}
              refreshSongs={refreshSongs}
            />
          )}
          {isParticipantsPage && (
            <TournamentHeaderParticipantsManageMenu onOpen={onOpenParticipantsManageModal} />
          )}
          {isLobbiesPage && (
            <TournamentHeaderLobbyManageMenu
              tournamentId={tournamentId}
              syncstartUrl={syncstartUrl}
              setSyncstartUrl={setSyncstartUrl}
            />
          )}
        </div>
      )}
    </div>
  );
}
