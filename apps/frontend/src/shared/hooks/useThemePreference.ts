import { useCallback, useEffect, useState } from "react";
import {
  applyThemePreference,
  readThemePreference,
  writeThemePreference,
  type ThemePreference,
} from "@/shared/services/themePreference";

/**
 * Reads and writes the device theme preference, applying it as it changes.
 *
 * The initial value is read once rather than applied on mount: index.html has
 * already put the attribute on the document before the first paint, so doing it
 * again here would be redundant work on every mount.
 */
export function useThemePreference(): [ThemePreference, (next: ThemePreference) => void] {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);

  const choose = useCallback((next: ThemePreference) => {
    setPreference(next);
    writeThemePreference(next);
    applyThemePreference(next);
  }, []);

  // Another tab may change the preference; follow it so the two stay in step.
  useEffect(() => {
    function onStorage() {
      const stored = readThemePreference();
      setPreference(stored);
      applyThemePreference(stored);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return [preference, choose];
}
