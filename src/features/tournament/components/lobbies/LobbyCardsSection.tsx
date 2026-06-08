import { LobbyCardStateDto } from "@/features/live/services/useScoreHub";
import LobbyCard from "./LobbyCard";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/free-solid-svg-icons";
import { btnSecondary } from "@/styles/buttonStyles";

type LobbyEntry = {
  lobby: {
    lobbyId: string;
    lobbyName: string;
    lobbyCode: string;
    isSpectated: boolean;
    isPasswordProtected: boolean;
    playerCount: number;
    spectatorCount: number;
  };
  lobbyState?: LobbyCardStateDto;
};

type Props = {
  lobbies: LobbyEntry[];
  connectionStatus: {
    isActive: boolean;
    isConnected: boolean;
  };
  connectingServer: boolean;
  disconnectingServer: boolean;
  onConnectServer: () => void;
  onDisconnectServer: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  onSpectate: (lobbyCode: string) => void;
  onDisconnect: (lobbyId: string) => Promise<void>;
};

export default function LobbyCardsSection({
  lobbies,
  connectionStatus,
  connectingServer,
  disconnectingServer,
  onConnectServer,
  onDisconnectServer,
  refreshing,
  onRefresh,
  onSpectate,
  onDisconnect,
}: Props) {
  return (
    <section className="p-1">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">SyncStart lobbies</h2>
          <p className="mt-1 text-sm text-gray-500">
            Available lobbies are listed from SyncStart. Active lobbies are being spectated by Tournament Manager.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                connectionStatus.isActive ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {connectionStatus.isActive ? "Active" : "Inactive"}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                connectionStatus.isConnected ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              }`}
            >
              {connectionStatus.isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connectionStatus.isConnected ? (
            <button
              type="button"
              onClick={onDisconnectServer}
              disabled={disconnectingServer}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {disconnectingServer ? "Disconnecting..." : "Disconnect"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onConnectServer}
              disabled={connectingServer || connectionStatus.isActive}
              className={`text-sm ${btnSecondary}`}
            >
              {connectingServer || connectionStatus.isActive ? "Connecting..." : "Connect"}
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing || !connectionStatus.isConnected}
            className={`flex items-center gap-2 text-sm ${btnSecondary}`}
          >
            <FontAwesomeIcon icon={faRotate} className={refreshing ? "animate-spin" : ""} />
            <span>{refreshing ? "Refreshing..." : "Refresh all"}</span>
          </button>
        </div>
      </div>

      {lobbies.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">No lobbies found.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {lobbies.map(({ lobby, lobbyState }) => (
            <LobbyCard
              key={lobby.lobbyId}
              lobbyId={lobby.lobbyId}
              lobbyName={lobby.lobbyName}
              lobbyCode={lobby.lobbyCode}
              isSpectated={lobby.isSpectated}
              isPasswordProtected={lobby.isPasswordProtected}
              playerCount={lobby.playerCount}
              spectatorCount={lobby.spectatorCount}
              lobbyState={lobbyState}
              onSpectate={onSpectate}
              onDisconnect={onDisconnect}
            />
          ))}
        </div>
      )}
    </section>
  );
}
