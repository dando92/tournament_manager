import { useLobbyControl } from "@/features/tournament/model/useLobbyControl";
import { btnPrimary, btnSecondary, focusRing } from "@/styles/buttonStyles";

type Props = {
  tournamentId: number;
};

export default function LobbyControlCard({ tournamentId }: Props) {
  const control = useLobbyControl(tournamentId);
  const lobbies = control.options.data?.lobbies ?? [];
  const songs = control.options.data?.songs ?? [];
  const disabled = control.options.isLoading || lobbies.length === 0 || songs.length === 0;

  return (
    <section className="rounded-xl border border-ui-border bg-ui-raised p-4">
      <div>
        <h2 className="text-lg font-bold text-ui-text">Lobby control</h2>
        <p className="mt-1 text-sm text-ui-text-mute">
          Select a song from an active match, move every listening cabinet to it, then start the cabinets waiting in gameplay.
        </p>
      </div>

      {control.options.isError ? (
        <p className="mt-4 rounded border border-state-failed/30 bg-state-failed/10 px-3 py-2 text-sm text-state-failed">
          Unable to load lobby controls.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold text-ui-text">
            Lobby
            <select
              value={control.lobbyId}
              onChange={(event) => control.setLobbyId(event.target.value)}
              disabled={control.options.isLoading || lobbies.length === 0}
              className={`mt-1 block w-full rounded border border-ui-border bg-ui-canvas px-3 py-2 font-normal text-ui-text disabled:opacity-50 ${focusRing}`}
            >
              {lobbies.length === 0 && <option value="">No lobby available</option>}
              {lobbies.map((lobby) => (
                <option key={lobby.id} value={lobby.id}>{lobby.name} ({lobby.lobbyCode})</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-ui-text">
            Song from active matches
            <select
              value={control.songId ?? ""}
              onChange={(event) => control.setSongId(Number(event.target.value))}
              disabled={control.options.isLoading || songs.length === 0}
              className={`mt-1 block w-full rounded border border-ui-border bg-ui-canvas px-3 py-2 font-normal text-ui-text disabled:opacity-50 ${focusRing}`}
            >
              {songs.length === 0 && <option value="">No song in an active match</option>}
              {songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={btnSecondary}
          disabled={disabled || control.selecting || control.starting}
          onClick={() => control.selectSong().catch(() => {})}
        >
          {control.selecting ? "Selecting…" : "Select song"}
        </button>
        <button
          type="button"
          className={btnPrimary}
          disabled={disabled || control.selecting || control.starting}
          onClick={() => control.startSong().catch(() => {})}
        >
          {control.starting ? "Starting…" : "Start cabinets"}
        </button>
      </div>
    </section>
  );
}
