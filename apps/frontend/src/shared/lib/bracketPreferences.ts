/**
 * The bracket the generator opens on, remembered on this device.
 *
 * A tournament tends to run the same kind of bracket in every division, so
 * naming it once and having the dialog keep offering the first type in the list
 * was work nobody's answer changed. The choice is not keyed on a tournament:
 * the types are a list the API owns, and the habit belongs to whoever generates
 * brackets rather than to the tournament being generated into.
 */

const STORAGE_KEY = 'bracket_type';

/** The remembered type while it is still one of the offered ones, the first one otherwise. */
export function readBracketType(bracketTypes: string[]): string {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null && bracketTypes.includes(stored)) {
            return stored;
        }
    } catch {
        /* Storage can be unavailable; the dialog then opens on the first type. */
    }

    return bracketTypes[0] ?? '';
}

/** Stores the choice, so the next bracket is generated the same way unless it is changed. */
export function writeBracketType(bracketType: string): void {
    try {
        localStorage.setItem(STORAGE_KEY, bracketType);
    } catch {
        /* Storage can be unavailable or full; the choice then lasts for this page only. */
    }
}
