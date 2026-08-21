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
    <article className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-900">{lobbyName}</h3>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">{lobbyCode}</p>
          </div>
        </div>
        {isSpectated ? (
          <button
            type="button"
            onClick={() => {
              onDisconnect(lobbyId).catch(() => {});
            }}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSpectate(lobbyCode)}
            className="rounded-lg border border-brand-700 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
          >
            Spectate
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg bg-white p-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Song</div>
          <div className="mt-1 font-semibold text-gray-800">
            {songName}
          </div>
        </div>
        <div className="rounded-lg bg-white p-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Lobby</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className="font-semibold text-gray-800">{playerCount} players</span>
            <span className="font-semibold text-gray-800">{spectatorCount} spectators</span>
            {isPasswordProtected && <span className="font-semibold text-gray-800">Password</span>}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs uppercase tracking-wide text-gray-500">Players</div>
        {sortedPlayers.length ? (
          <div className="mt-2 flex flex-col gap-2">
            {sortedPlayers.map((player) => (
                <div
                  key={`${lobbyId}-${player.playerId}-${player.playerName}`}
                  className="relative flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-semibold text-gray-900">{player.playerName}</div>
                    <div className="text-xs text-gray-500">{player.playerId}</div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                      player.ready
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {player.ready ? "Ready" : "Not ready"}
                  </span>
                </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500">Waiting for lobby state...</p>
        )}
      </div>
    </article>
  );
}
