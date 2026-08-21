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
 * An active match breathes. It is the one thing in the interface that changes
 * without anybody touching it, and motion is the only channel that catches an
 * eye which is not already pointed at it. `motion-safe` keeps it out of the way
 * of anyone who has asked the system for less movement. Nothing else in the
 * application animates state, so this stays a signal rather than decoration.
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
        <StatusIcon status={on ? "running" : "idle"} label={label} className={on ? "motion-safe:animate-pulse" : ""} />
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
