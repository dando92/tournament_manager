import { useEffect, useRef, useState } from "react";
import StatusIcon from "@/shared/components/ui/StatusIcon";

const TAP_TOOLTIP_MS = 2000;

type StatusDotProps = {
  on: boolean;
  label: string;
};

/**
 * A purely informative status dot with its own tooltip.
 *
 * The dot never performs an action. It is a button only because touch devices
 * have no hover: tapping it reveals the same tooltip a pointer gets for free,
 * and the tooltip hides itself again shortly after.
 *
 * It does not move. Motion in this application belongs to the one state that
 * is waiting for somebody, and an active match is not waiting for anybody — it
 * is being played. Active is therefore reported by the blue half-filled ring
 * and nothing else. See .ai/Design.md.
 */
export default function StatusDot({ on, label }: StatusDotProps) {
  const [tapped, setTapped] = useState(false);
  const hideTimeout = useRef<number>();

  useEffect(() => () => window.clearTimeout(hideTimeout.current), []);

  function showTooltipOnTap(event: React.MouseEvent) {
    event.stopPropagation();
    setTapped(true);
    window.clearTimeout(hideTimeout.current);
    hideTimeout.current = window.setTimeout(() => setTapped(false), TAP_TOOLTIP_MS);
  }

  return (
    <span className="group relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={label}
        onClick={showTooltipOnTap}
        onBlur={() => setTapped(false)}
        className="-m-1.5 flex cursor-default items-center p-1.5"
      >
        <StatusIcon status={on ? "running" : "idle"} label={label} />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-ui-text px-2 py-1 text-[11px] font-medium text-ui-surface transition-opacity ${
          tapped ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {label}
      </span>
    </span>
  );
}
