/**
 * What the song dialogs open on, remembered per tournament on this device.
 *
 * Putting songs on a match is repetitive work: the same pack, the same way of
 * choosing, the same answer about what may be played again. Asking all of it
 * over from scratch on every opening is what made it tedious, so a dialog opens
 * on the last answer and whoever wants a different one changes it. These are
 * device preferences beside the theme and the pool view mode, not domain data,
 * which is why two organisers on two machines can hold different ones.
 */

/** The choices a song dialog carries from one opening to the next. */
export type SongDialogChoices = {
    /** Whether songs are named or drawn. */
    mode: 'title' | 'roll';
    /** The pack the title picker filters by. Empty means nothing was chosen yet. */
    titlePack: string;
    /** The pack a draw is limited to. Empty means every pack, which is what a draw reaches by default. */
    rollPack: string;
    /** Whether a draw may offer songs the division has already played. */
    allowPlayed: boolean;
};

const STORAGE_KEY = 'song_dialog_choices';

/** What a dialog opens on when nothing was remembered for it. */
const DEFAULTS: SongDialogChoices = { mode: 'title', titlePack: '', rollPack: '', allowPlayed: false };

/**
 * The remembered choices, or the ones the dialog would use anyway.
 *
 * Every field is read defensively: the store is a device file somebody can edit
 * and a tournament can lose the pack that was chosen in it, so a value that is
 * not what it claims to be is the default rather than a broken dialog.
 */
export function readSongDialogChoices(tournamentId: number | undefined): SongDialogChoices {
    if (tournamentId === undefined) {
        return { ...DEFAULTS };
    }

    const stored = readStored()[String(tournamentId)] ?? {};

    return {
        mode: stored.mode === 'roll' ? 'roll' : 'title',
        titlePack: typeof stored.titlePack === 'string' ? stored.titlePack : '',
        rollPack: typeof stored.rollPack === 'string' ? stored.rollPack : '',
        allowPlayed: stored.allowPlayed === true,
    };
}

/** Stores one choice, or drops it when it is the default the dialog would use anyway. */
export function writeSongDialogChoice<K extends keyof SongDialogChoices>(tournamentId: number | undefined, choice: K, value: SongDialogChoices[K]): void {
    if (tournamentId === undefined) {
        return;
    }

    const stored = readStored();
    const key = String(tournamentId);
    const entry = { ...stored[key] };
    if (value === DEFAULTS[choice]) {
        delete entry[choice];
    } else {
        entry[choice] = value;
    }

    if (Object.keys(entry).length === 0) {
        delete stored[key];
    } else {
        stored[key] = entry;
    }

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
        /* Storage can be unavailable or full; the choice then lasts for this page only. */
    }
}

/**
 * The remembered pack while the catalogue still holds it, the fallback otherwise.
 *
 * A pack is remembered by name, and the pool it was chosen from can be imported
 * again under other names. A dialog that kept filtering by a pack nobody has
 * would show an empty list and no reason for it.
 */
export function rememberedPack(pack: string, packs: string[], fallback: string): string {
    return pack !== '' && packs.includes(pack) ? pack : fallback;
}

function readStored(): Record<string, Partial<SongDialogChoices>> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return {};
        }

        const parsed: unknown = JSON.parse(raw);

        return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, Partial<SongDialogChoices>>) : {};
    } catch {
        return {};
    }
}
