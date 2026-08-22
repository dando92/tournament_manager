import { LobbyCardStateDto } from "@/features/live/model/types";
import { StatusBadge } from "@/shared/components/ui/StatusIcon";
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
            <StatusBadge
              status={connectionStatus.isActive ? "running" : "idle"}
              label={connectionStatus.isActive ? "Active" : "Inactive"}
            />
            <StatusBadge
              status={connectionStatus.isConnected ? "done" : "failed"}
              label={connectionStatus.isConnected ? "Connected" : "Disconnected"}
            />
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
