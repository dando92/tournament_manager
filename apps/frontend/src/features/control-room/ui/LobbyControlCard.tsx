import { useLobbyControl } from "@/features/tournament/model/useLobbyControl";
import Select from "@/shared/components/ui/Select";
import { btnPrimary, btnSecondary } from "@/styles/buttonStyles";
import { displaySongTitle } from "@/features/song/model/songTitle";

export default function LobbyControlCard({ tournamentId }: { tournamentId: number }) {
    const control = useLobbyControl(tournamentId);
    const lobbies = control.options.data?.lobbies ?? [];
    const songs = control.options.data?.songs ?? [];
    const disabled = control.options.isLoading || lobbies.length === 0 || songs.length === 0;

    return (
        <section className="rounded-xl border border-ui-border bg-ui-raised p-4">
            <h3 className="font-bold text-ui-text">Lobby control</h3>
            <p className="mt-1 text-sm text-ui-text-mute">Choose a lobby and a song from the tournament&apos;s active matches.</p>

            {control.options.isError ? (
                <p className="mt-4 rounded border border-state-failed/30 bg-state-failed/10 px-3 py-2 text-sm text-state-failed">
                    Unable to load lobby controls.
                </p>
            ) : (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="text-sm font-semibold text-ui-text">
                        Lobby
                        <Select
                            className="mt-1 font-normal"
                            value={control.lobbyId}
                            onChange={(lobbyId) => control.setLobbyId(lobbyId)}
                            options={lobbies.map((lobby) => ({ value: lobby.id, label: `${lobby.name} (${lobby.lobbyCode})` }))}
                            placeholder="No lobby available"
                            disabled={control.options.isLoading || lobbies.length === 0}
                        />
                    </label>
                    <label className="text-sm font-semibold text-ui-text">
                        Song from active matches
                        <Select
                            className="mt-1 font-normal"
                            value={control.songId}
                            onChange={(songId) => control.setSongId(songId)}
                            options={songs.map((song) => ({ value: song.id, label: displaySongTitle(song.title) }))}
                            placeholder="No song in an active match"
                            disabled={control.options.isLoading || songs.length === 0}
                        />
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
