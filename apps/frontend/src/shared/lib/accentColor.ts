/**
 * The one colour the interface carries, remembered on this device.
 *
 * Everything else in the chrome is a step of the neutral scale; `--ui-accent`
 * is the single hue, reserved for selection bars and keyboard focus. It is a
 * device preference beside the theme rather than domain data: the same
 * tournament looks the same to everyone, and the machine it is being run from
 * gets to look the way its owner wants.
 *
 * The value is stored as a hex string because that is what a colour input
 * speaks; the document wants space-separated RGB channels, so Tailwind's
 * opacity modifiers (`ring-ui-accent/60`) keep working, and the conversion
 * happens here.
 */

/**
 * The accent the interface uses until someone picks another one.
 *
 * This is the value `--ui-accent` already holds in tokens.css, repeated here
 * because a preference has to know when it is back on the default and stylesheet
 * values cannot be read before the stylesheet loads. Keep the two in step.
 */
export const DEFAULT_ACCENT_COLOR = '#5F858E';

export const STORAGE_KEY = 'accent_color';

/**
 * Accents offered as one click.
 *
 * They sit at the same lightness as the default teal and are desaturated to the
 * same degree, so each one stays a selection bar rather than becoming a block of
 * colour, and each behaves the same way against both the light and the dark
 * surfaces. Anything else is still reachable through the colour input.
 */
export const ACCENT_PRESETS: { name: string; value: string }[] = [
    { name: 'Teal', value: DEFAULT_ACCENT_COLOR },
    { name: 'Blue', value: '#5B7FA8' },
    { name: 'Violet', value: '#8A6FA6' },
    { name: 'Rose', value: '#A96F80' },
    { name: 'Amber', value: '#A8834F' },
    { name: 'Green', value: '#5F8E6E' },
];

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** The value as a six-digit lowercase-free hex colour, or null when it is not one. */
export function normalizeAccentColor(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return HEX_COLOR.test(trimmed) ? trimmed.toUpperCase() : null;
}

/** The channels a hex colour carries, in the form the custom property wants. */
export function accentChannels(color: string): string {
    const channels = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16));
    return channels.join(' ');
}

/**
 * Black or white, whichever the accent can be read against.
 *
 * Two controls fill themselves with the accent and draw a glyph on top. White
 * holds against the accents this interface was designed around, and stops
 * holding once someone picks something bright, which is the whole reason the
 * choice cannot be hard-coded any more. The threshold sits well above the
 * default teal so the interface nobody has customised is untouched.
 */
export function accentContrastChannels(color: string): string {
    const channels = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16));
    const [red, green, blue] = channels.map((channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    return luminance > 0.4 ? '0 0 0' : '255 255 255';
}

/** The stored accent, or the default when nothing valid is stored. */
export function readAccentColor(): string {
    try {
        return normalizeAccentColor(localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_ACCENT_COLOR;
    } catch {
        return DEFAULT_ACCENT_COLOR;
    }
}

/** Stores the accent, or drops the entry when it is the default anyway. */
export function writeAccentColor(color: string): void {
    try {
        if (color === DEFAULT_ACCENT_COLOR) {
            localStorage.removeItem(STORAGE_KEY);
        } else {
            localStorage.setItem(STORAGE_KEY, color);
        }
    } catch {
        /* Storage can be unavailable or full; the choice then lasts for this page only. */
    }
}

/**
 * Applies an accent to the document.
 *
 * The default clears the properties instead of writing them, so tokens.css stays
 * the one place the default accent is painted from and a device that never chose
 * one carries no inline style at all.
 */
export function applyAccentColor(color: string): void {
    const root = document.documentElement;
    if (color === DEFAULT_ACCENT_COLOR) {
        root.style.removeProperty('--ui-accent');
        root.style.removeProperty('--ui-accent-contrast');
    } else {
        root.style.setProperty('--ui-accent', accentChannels(color));
        root.style.setProperty('--ui-accent-contrast', accentContrastChannels(color));
    }
}
