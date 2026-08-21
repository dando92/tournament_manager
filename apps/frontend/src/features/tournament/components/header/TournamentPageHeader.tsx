import type { Dispatch, SetStateAction } from "react";
import { ParticipantsManageModal } from "@/features/tournament/context/TournamentPageContext";
import TournamentBreadcrumb from "@/features/tournament/components/header/TournamentBreadcrumb";
import TournamentHeaderLobbyManageMenu from "@/features/tournament/components/header/TournamentHeaderLobbyManageMenu";
import TournamentHeaderParticipantsManageMenu from "@/features/tournament/components/header/TournamentHeaderParticipantsManageMenu";
import TournamentHeaderSongsManageMenu from "@/features/tournament/components/header/TournamentHeaderSongsManageMenu";

/**
 * The header of whatever the tree has open.
 *
 * One rule governs it: the left says *where you are*, the right says *what you
 * can do here*. Creating divisions, phases, pools and brackets is no longer on
 * the right — those act on a node, so they live in that node's context menu in
 * the tree, where the target is unambiguous.
 */

type TournamentPageHeaderProps = {
  tournamentId: number;
  tournamentName: string;
  controls: boolean;
  isSongsPage: boolean;
  isParticipantsPage: boolean;
  isLobbiesPage: boolean;
  songsVersion: number;
  refreshSongs: () => void;
  onOpenParticipantsManageModal: Dispatch<SetStateAction<ParticipantsManageModal>>;
};

export default function TournamentPageHeader({
  tournamentId,
  tournamentName,
  controls,
  isSongsPage,
  isParticipantsPage,
  isLobbiesPage,
  songsVersion,
  refreshSongs,
  onOpenParticipantsManageModal,
}: TournamentPageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <TournamentBreadcrumb tournamentName={tournamentName} />

      {controls && (
        <div className="ml-auto flex items-center gap-2">
          {isSongsPage && (
            <TournamentHeaderSongsManageMenu
              tournamentId={tournamentId}
              songsVersion={songsVersion}
              refreshSongs={refreshSongs}
            />
          )}
          {isParticipantsPage && <TournamentHeaderParticipantsManageMenu onOpen={onOpenParticipantsManageModal} />}
          {isLobbiesPage && <TournamentHeaderLobbyManageMenu tournamentId={tournamentId} />}
        </div>
      )}
    </div>
  );
}
