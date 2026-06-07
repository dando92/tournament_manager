import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faPlug, faSatelliteDish } from "@fortawesome/free-solid-svg-icons";
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
    connectLobbyModalOpen,
    creatingLobby,
    connectingLobby,
    createLobbyName,
    createLobbyPassword,
    connectLobbyName,
    connectLobbyCode,
    connectLobbyPassword,
    setCreateLobbyModalOpen,
    setConnectLobbyModalOpen,
    setCreateLobbyName,
    setCreateLobbyPassword,
    setConnectLobbyName,
    setConnectLobbyCode,
    setConnectLobbyPassword,
    toggleMenu,
    closeMenu,
    openCreateLobbyModal,
    openConnectLobbyModal,
    handleCreateLobby,
    handleConnectLobby,
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

      <HeaderActionModal
        open={connectLobbyModalOpen}
        onClose={() => setConnectLobbyModalOpen(false)}
        title="Connect to lobby"
        description="Attach Tournament Manager to an existing SyncStart lobby."
        confirmLabel="Connect"
        loading={connectingLobby}
        onConfirm={() => {
          handleConnectLobby().catch(() => {});
        }}
      >
        <input
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="Display name"
          value={connectLobbyName}
          onChange={(event) => setConnectLobbyName(event.target.value)}
        />
        <input
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase"
          placeholder="Lobby code"
          value={connectLobbyCode}
          onChange={(event) => setConnectLobbyCode(event.target.value.toUpperCase())}
        />
        <input
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="Password (optional)"
          type="password"
          value={connectLobbyPassword}
          onChange={(event) => setConnectLobbyPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleConnectLobby().catch(() => {});
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
              <button
                type="button"
                onClick={openConnectLobbyModal}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <FontAwesomeIcon icon={faPlug} className="text-primary-dark" />
                Connect to lobby
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
