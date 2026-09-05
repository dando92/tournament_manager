/**
 * Which packs the songs page keeps open, remembered on this device.
 *
 * A pool is read pack by pack, so every pack starts closed and only the ones
 * somebody opened are stored. Like the theme and the remembered dialog choices,
 * this is a device preference and is never sent anywhere.
 */

const STORAGE_KEY = 'songs_expanded_packs';

/** The packs left open, or none when nothing was remembered. */
export function readExpandedSongPacks(): Set<string> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return new Set();
        }

        const parsed: unknown = JSON.parse(raw);

        return Array.isArray(parsed) ? new Set(parsed.filter((pack): pack is string => typeof pack === 'string')) : new Set();
    } catch {
        return new Set();
    }
}

/** Stores the packs left open, so the page opens on them again. */
export function writeExpandedSongPacks(packs: ReadonlySet<string>): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...packs]));
    } catch {
        /* Storage can be unavailable; the packs then stay open for this page only. */
    }
}
