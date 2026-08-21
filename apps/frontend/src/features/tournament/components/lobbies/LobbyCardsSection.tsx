import { LobbyCardStateDto } from "@/features/live/services/syncstartGatewayDtos";
import LobbyCard from "./LobbyCard";

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
  onSpectate: (lobbyCode: string) => void;
  onDisconnect: (lobbyId: string) => Promise<void>;
};

export default function LobbyCardsSection({
  lobbies,
  connectionStatus,
  onSpectate,
  onDisconnect,
}: Props) {
  return (
    <section className="p-1">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ui-text">SyncStart lobbies</h2>
          <p className="mt-1 text-sm text-ui-text-mute">
            Available lobbies are listed from SyncStart. Active lobbies are being spectated by Tournament Manager.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                connectionStatus.isActive ? "bg-ui-raised text-ui-text" : "bg-ui-selected text-ui-text-mute"
              }`}
            >
              {connectionStatus.isActive ? "Active" : "Inactive"}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                connectionStatus.isConnected ? "bg-state-done/10 text-ui-text-soft" : "bg-state-failed/10 text-state-failed"
              }`}
            >
              {connectionStatus.isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>

      {lobbies.length === 0 ? (
        <p className="mt-4 text-sm text-ui-text-mute">No lobbies found.</p>
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
