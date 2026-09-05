import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretDown, faCaretUp } from "@fortawesome/free-solid-svg-icons";

/**
 * How far somebody beat, or missed, the seed they were given.
 *
 * The colour sits on the caret and the number stays neutral, which is the rule
 * the design system already states: a state colour reinforces a glyph and never
 * becomes the only way to read something. Finishing where you were seeded is
 * nothing to report, so it draws nothing.
 */
export default function SeedSwing({ swing }: { swing: number | null }) {
  if (swing === null || swing === 0) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-ui-text-soft">
      <FontAwesomeIcon icon={swing > 0 ? faCaretUp : faCaretDown} className={swing > 0 ? "text-state-done" : "text-state-failed"} />
      {Math.abs(swing)}
    </span>
  );
}
