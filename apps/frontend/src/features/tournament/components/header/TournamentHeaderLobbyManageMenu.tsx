import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faPlug, faPowerOff, faRotate, faSatelliteDish } from "@fortawesome/free-solid-svg-icons";
import { btnPrimary } from "@/styles/buttonStyles";
import { useTournamentLobbiesContext } from "@/features/tournament/context/TournamentLobbiesContext";
import { useTournamentHeaderLobbyManageMenu } from "@/features/tournament/hooks/useTournamentHeaderLobbyManageMenu";
import HeaderActionModal from "./HeaderActionModal";

type Props = {
  tournamentId: number;
};

export default function TournamentHeaderLobbyManageMenu({
  tournamentId,
}: Props) {
  const {
    connectionStatus,
    connectingServer,
    disconnectingServer,
    refreshing,
    handleConnectServer,
    handleDisconnectServer,
    refreshLobbies,
  } = useTournamentLobbiesContext();
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
    canCreateLobby: connectionStatus.isConnected,
  });

  const menuItemClass =
    "flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-500 disabled:hover:bg-white";

  return (
    <>
      <HeaderActionModal
        open={createLobbyModalOpen}
        onClose={() => setCreateLobbyModalOpen(false)}
        title="Create lobby"
        description="Create a new SyncStart lobby that players can join from their machines."
        confirmLabel="Create lobby"
        loading={creatingLobby}
        confirmDisabled={!connectionStatus.isConnected}
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
              {connectionStatus.isConnected ? (
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    handleDisconnectServer().catch(() => {});
                  }}
                  disabled={disconnectingServer}
                  className={menuItemClass}
                >
                  <FontAwesomeIcon icon={faPowerOff} className="text-red-600" />
                  {disconnectingServer ? "Disconnecting..." : "Disconnect"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    handleConnectServer().catch(() => {});
                  }}
                  disabled={connectingServer || connectionStatus.isActive}
                  className={menuItemClass}
                >
                  <FontAwesomeIcon icon={faPlug} className="text-brand-700" />
                  {connectingServer || connectionStatus.isActive ? "Connecting..." : "Connect"}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  refreshLobbies().catch(() => {});
                }}
                disabled={refreshing || !connectionStatus.isConnected}
                className={menuItemClass}
              >
                <FontAwesomeIcon icon={faRotate} className={refreshing ? "animate-spin text-brand-700" : "text-brand-700"} />
                {refreshing ? "Refreshing..." : "Refresh all"}
              </button>
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                onClick={openCreateLobbyModal}
                disabled={!connectionStatus.isConnected}
                className={menuItemClass}
              >
                <FontAwesomeIcon
                  icon={faSatelliteDish}
                  className={connectionStatus.isConnected ? "text-brand-700" : "text-gray-500"}
                />
                Create lobby
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
