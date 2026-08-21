import { useEffect, useRef, useState } from "react";

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
        <span
          aria-hidden
          className={`h-2.5 w-2.5 rounded-full ring-2 ${on ? "bg-green-500 ring-green-100" : "bg-gray-300 ring-gray-100"}`}
        />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-[11px] font-medium text-white transition-opacity ${
          tapped ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {label}
      </span>
    </span>
  );
}
