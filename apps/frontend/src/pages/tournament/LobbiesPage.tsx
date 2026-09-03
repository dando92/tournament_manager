import { Navigate } from "react-router-dom";
import LobbyCardsSection from "@/features/tournament/ui/lobbies/LobbyCardsSection";
import { useTournamentLobbiesContext } from "@/features/tournament/model/TournamentLobbiesContext";
import { useTournamentPageContext } from "@/features/tournament/model/TournamentPageContext";
import FormModal from "@/shared/components/ui/FormModal";

export default function LobbiesPage() {
  const { tournamentId, controls } = useTournamentPageContext();
  const {
    lobbies,
    connectionStatus,
    spectateModal,
    setSpectateModal,
    openSpectateModal,
    closeSpectateModal,
    handleSpectateLobby,
    handleDisconnectLobby,
  } = useTournamentLobbiesContext();

  if (!controls) {
    return <Navigate to={`/tournament/${tournamentId}/schedule`} replace />;
  }

  return (
    <div className="flex flex-col gap-6">
      <FormModal
        open={spectateModal.open}
        onClose={closeSpectateModal}
        title={`Spectate ${spectateModal.lobbyCode}`}
        confirmText="Spectate"
        validate={() => (spectateModal.lobbyCode ? [] : ["Lobby code is required."])}
        onConfirm={handleSpectateLobby}
        failureFallback="That lobby could not be spectated."
        maxWidth="max-w-md"
      >
        <input
          className="rounded-lg border border-ui-border-strong px-3 py-2 text-sm"
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
          className="rounded-lg border border-ui-border-strong px-3 py-2 text-sm"
          placeholder="Password (optional)"
          type="password"
          value={spectateModal.password}
          onChange={(event) =>
            setSpectateModal((current) => ({
              ...current,
              password: event.target.value,
            }))
          }
        />
      </FormModal>

      <LobbyCardsSection
        lobbies={lobbies}
        connectionStatus={connectionStatus}
        onSpectate={openSpectateModal}
        onDisconnect={handleDisconnectLobby}
      />
    </div>
  );
}
