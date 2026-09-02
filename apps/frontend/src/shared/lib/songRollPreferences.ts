/**
 * How this device draws songs, remembered per tournament.
 *
 * Whether a draw may offer songs the division has already played is a choice
 * somebody makes once for the tournament they are running and then stops
 * thinking about, so the dialog opens on the last answer instead of asking
 * again. It lives beside the theme and the pool view mode: a device
 * preference, not domain data, which is why two organisers on two machines can
 * hold different ones.
 */

const STORAGE_KEY = 'song_roll_allow_played';

/** Whether draws in this tournament may repeat what the division has played. Off until said otherwise. */
export function readAllowPlayed(tournamentId: number | undefined): boolean {
    if (tournamentId === undefined) {
        return false;
    }

    return readStored()[String(tournamentId)] === true;
}

/** Stores the choice, or drops the entry when it is the default the draw would use anyway. */
export function writeAllowPlayed(tournamentId: number | undefined, allowPlayed: boolean): void {
    if (tournamentId === undefined) {
        return;
    }

    const stored = readStored();
    if (allowPlayed) {
        stored[String(tournamentId)] = true;
    } else {
        delete stored[String(tournamentId)];
    }

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
        /* Storage can be unavailable or full; the choice then lasts for this page only. */
    }
}

function readStored(): Record<string, boolean> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return {};
        }

        const parsed: unknown = JSON.parse(raw);

        return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, boolean>) : {};
    } catch {
        return {};
    }
}
