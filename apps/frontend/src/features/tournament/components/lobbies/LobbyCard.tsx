import { LobbyCardStateDto } from "@/features/live/services/syncstartGatewayDtos";

type Props = {
  lobbyId: string;
  lobbyName: string;
  lobbyCode: string;
  isSpectated: boolean;
  isPasswordProtected: boolean;
  playerCount: number;
  spectatorCount: number;
  lobbyState?: LobbyCardStateDto;
  onSpectate: (lobbyCode: string) => void;
  onDisconnect: (lobbyId: string) => Promise<void>;
};

export default function LobbyCard({
  lobbyId,
  lobbyName,
  lobbyCode,
  isSpectated,
  isPasswordProtected,
  playerCount,
  spectatorCount,
  lobbyState,
  onSpectate,
  onDisconnect,
}: Props) {
  const sortedPlayers = [...(lobbyState?.players ?? [])].sort((a, b) =>
    a.playerName.localeCompare(b.playerName),
  );
  const songName = lobbyState?.songTitle || lobbyState?.songPath || "No song selected";

  return (
    <article className="rounded-xl border border-ui-border bg-ui-raised p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-ui-text">{lobbyName}</h3>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-xs uppercase tracking-wide text-ui-text-mute">{lobbyCode}</p>
          </div>
        </div>
        {isSpectated ? (
          <button
            type="button"
            onClick={() => {
              onDisconnect(lobbyId).catch(() => {});
            }}
            className="rounded-lg border border-state-failed/30 px-3 py-1.5 text-xs font-semibold text-state-failed hover:bg-state-failed/10"
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSpectate(lobbyCode)}
            className="rounded-lg border border-ui-border-strong px-3 py-1.5 text-xs font-semibold text-ui-text hover:bg-ui-selected"
          >
            Spectate
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg bg-ui-surface p-3">
          <div className="text-xs uppercase tracking-wide text-ui-text-mute">Song</div>
          <div className="mt-1 font-semibold text-ui-text">
            {songName}
          </div>
        </div>
        <div className="rounded-lg bg-ui-surface p-3">
          <div className="text-xs uppercase tracking-wide text-ui-text-mute">Lobby</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className="font-semibold text-ui-text">{playerCount} players</span>
            <span className="font-semibold text-ui-text">{spectatorCount} spectators</span>
            {isPasswordProtected && <span className="font-semibold text-ui-text">Password</span>}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs uppercase tracking-wide text-ui-text-mute">Players</div>
        {sortedPlayers.length ? (
          <div className="mt-2 flex flex-col gap-2">
            {sortedPlayers.map((player) => (
                <div
                  key={`${lobbyId}-${player.playerId}-${player.playerName}`}
                  className="relative flex items-center justify-between rounded-lg bg-ui-surface px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-semibold text-ui-text">{player.playerName}</div>
                    <div className="text-xs text-ui-text-mute">{player.playerId}</div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                      player.ready
                        ? "bg-state-done/10 text-ui-text-soft"
                        : "bg-state-failed/10 text-state-failed"
                    }`}
                  >
                    {player.ready ? "Ready" : "Not ready"}
                  </span>
                </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-ui-text-mute">Waiting for lobby state...</p>
        )}
      </div>
    </article>
  );
}
