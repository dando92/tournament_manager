import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDesktop, faMoon, faSun } from "@fortawesome/free-solid-svg-icons";
import { useThemePreference } from "@/shared/hooks/useThemePreference";
import { THEME_PREFERENCES, type ThemePreference } from "@/shared/lib/themePreference";

const THEME_ICON: Record<ThemePreference, typeof faSun> = {
  light: faSun,
  dark: faMoon,
  system: faDesktop,
};

export default function ThemePreferenceSection() {
  const [theme, chooseTheme] = useThemePreference();

  return (
    <section className="overflow-hidden rounded-lg border border-ui-border bg-ui-surface">
      <div className="flex items-center gap-2 border-b border-ui-border bg-ui-selected px-4 py-2 text-sm font-semibold text-ui-text">
        <FontAwesomeIcon icon={faMoon} />
        <h2>Appearance</h2>
      </div>
      <div className="flex flex-col gap-2 px-4 py-3">
        <p className="text-xs text-ui-text-mute">
          Applies to this device only. &ldquo;System&rdquo; follows the setting of your operating system.
        </p>
        <div className="flex flex-wrap gap-2">
          {THEME_PREFERENCES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={theme === option}
              onClick={() => chooseTheme(option)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm capitalize transition-colors ${
                theme === option
                  ? "border-ui-border-strong bg-ui-selected font-semibold text-ui-text"
                  : "border-ui-border text-ui-text-soft hover:bg-ui-raised hover:text-ui-text"
              }`}
            >
              <FontAwesomeIcon icon={THEME_ICON[option]} className="text-xs" />
              {option}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
