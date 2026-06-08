import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faSatelliteDish } from "@fortawesome/free-solid-svg-icons";
import { btnPrimary } from "@/styles/buttonStyles";
import { useTournamentHeaderLobbyManageMenu } from "@/features/tournament/hooks/useTournamentHeaderLobbyManageMenu";
import HeaderActionModal from "./HeaderActionModal";

type Props = {
  tournamentId: number;
};

export default function TournamentHeaderLobbyManageMenu({
  tournamentId,
}: Props) {
  const {
    menuOpen,
    createLobbyModalOpen,
    creatingLobby,
    createLobbyName,
    createLobbyPassword,
    setCreateLobbyModalOpen,
    setCreateLobbyName,
    setCreateLobbyPassword,
    toggleMenu,
    closeMenu,
    openCreateLobbyModal,
    handleCreateLobby,
  } = useTournamentHeaderLobbyManageMenu({
    tournamentId,
  });

  return (
    <>
      <HeaderActionModal
        open={createLobbyModalOpen}
        onClose={() => setCreateLobbyModalOpen(false)}
        title="Create lobby"
        description="Create a new SyncStart lobby that players can join from their machines."
        confirmLabel="Create lobby"
        loading={creatingLobby}
        onConfirm={() => {
          handleCreateLobby().catch(() => {});
        }}
      >
        <input
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="Lobby name"
          value={createLobbyName}
          onChange={(event) => setCreateLobbyName(event.target.value)}
        />
        <input
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="Password (optional)"
          type="password"
          value={createLobbyPassword}
          onChange={(event) => setCreateLobbyPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleCreateLobby().catch(() => {});
            }
          }}
        />
      </HeaderActionModal>

      <div className="relative">
        <button
          type="button"
          onClick={toggleMenu}
          className={`flex items-center gap-2 ${btnPrimary}`}
        >
          Manage
          <FontAwesomeIcon icon={faChevronDown} className="text-xs" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={closeMenu} />
            <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded shadow-lg border border-gray-200 min-w-[190px]">
              <button
                type="button"
                onClick={openCreateLobbyModal}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <FontAwesomeIcon icon={faSatelliteDish} className="text-primary-dark" />
                Create lobby
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
