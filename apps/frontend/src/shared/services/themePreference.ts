/**
 * Which theme the interface renders in. This is a device preference, not domain
 * data: the right theme depends on where you are — a laptop in the venue, a
 * projector, a phone — rather than on who you are.
 *
 * "system" is stored as a value rather than as the absence of one, so that
 * choosing it after having chosen dark is a real choice and not a reset.
 */
export type ThemePreference = "light" | "dark" | "system";

export const THEME_PREFERENCES: ThemePreference[] = ["light", "dark", "system"];

export const STORAGE_KEY = "theme_preference";

/** The theme a device uses until someone picks another one on it. */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as string[]).includes(value);
}

/** The stored choice, or the default when nothing valid is stored. */
export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isThemePreference(stored) ? stored : DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

/** Stores the choice, or drops the entry when it is the default anyway. */
export function writeThemePreference(preference: ThemePreference): void {
  try {
    if (preference === DEFAULT_THEME_PREFERENCE) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, preference);
    }
  } catch {
    /* Storage can be unavailable or full; the choice then lasts for this page only. */
  }
}

/**
 * Applies a preference to the document.
 *
 * "system" removes the attribute rather than resolving it here, so the media
 * query in tokens.css stays the single place that reads the operating system —
 * and the page follows it live when the user changes it.
 */
export function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = preference;
  }
}
