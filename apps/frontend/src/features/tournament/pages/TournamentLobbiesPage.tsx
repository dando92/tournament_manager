import { Navigate } from "react-router-dom";
import LobbyCardsSection from "@/features/tournament/components/lobbies/LobbyCardsSection";
import { useTournamentLobbiesContext } from "@/features/tournament/context/TournamentLobbiesContext";
import { useTournamentPageContext } from "@/features/tournament/context/TournamentPageContext";
import BaseModal from "@/shared/components/ui/BaseModal";
import { btnPrimary, btnSecondary } from "@/styles/buttonStyles";

export default function TournamentLobbiesPage() {
  const { tournamentId, controls } = useTournamentPageContext();
  const {
    lobbies,
    connectionStatus,
    spectateModal,
    setSpectateModal,
    spectating,
    openSpectateModal,
    closeSpectateModal,
    handleSpectateLobby,
    handleDisconnectLobby,
  } = useTournamentLobbiesContext();

  if (!controls) {
    return <Navigate to={`/tournament/${tournamentId}/overview`} replace />;
  }

  return (
    <div className="flex flex-col gap-6">
      <BaseModal
        open={spectateModal.open}
        onClose={closeSpectateModal}
        title={`Spectate ${spectateModal.lobbyCode}`}
        maxWidth="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={closeSpectateModal} disabled={spectating} className={btnSecondary}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                handleSpectateLobby().catch(() => {});
              }}
              disabled={spectating}
              className={btnPrimary}
            >
              {spectating ? "Spectating..." : "Spectate"}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <input
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Lobby name"
            value={spectateModal.lobbyName}
            onChange={(event) =>
              setSpectateModal((current) => ({
                ...current,
                lobbyName: event.target.value,
              }))
            }
          />
          <input
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Password (optional)"
            type="password"
            value={spectateModal.password}
            onChange={(event) =>
              setSpectateModal((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSpectateLobby().catch(() => {});
              }
            }}
          />
        </div>
      </BaseModal>

      <LobbyCardsSection
        lobbies={lobbies}
        connectionStatus={connectionStatus}
        onSpectate={openSpectateModal}
        onDisconnect={handleDisconnectLobby}
      />
    </div>
  );
}
