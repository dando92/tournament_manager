/**
 * The status glyph.
 *
 * The ring fills as a match moves forward — dashed, half, three quarters, then
 * solid — so the state is carried by the shape before it is carried by the
 * colour. A list of matches stays readable in greyscale, and for a viewer who
 * cannot separate the hues nothing is lost.
 *
 * This is the only place in the interface where colour reports state, which is
 * why the state scale is defined for a 3:1 graphical threshold rather than the
 * 4.5:1 that text needs. See .ai/Design.md.
 */

import { STATUS_LABEL, type Status } from "@/shared/components/ui/status";

const RADIUS = 2.75;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const TONE: Record<Status, string> = {
  idle: "text-state-idle",
  running: "text-state-running",
  pending: "text-state-pending",
  done: "text-state-done",
  failed: "text-state-failed",
};

/** How much of the ring is filled, for the states drawn as a progress ring. */
const FILL: Partial<Record<Status, number>> = {
  idle: 0,
  running: 0.5,
  pending: 0.75,
};

const CHECK = "M4.3 7.2 6.2 9.1 9.8 4.9";
const CROSS = "M4.8 4.8 9.2 9.2 M9.2 4.8 4.8 9.2";

type StatusIconProps = {
  status: Status;
  /** Overrides the default label announced to assistive technology. */
  label?: string;
  className?: string;
};

export default function StatusIcon({ status, label, className = "" }: StatusIconProps) {
  const solid = status === "done" || status === "failed";
  const fill = FILL[status] ?? 0;

  return (
    <svg
      viewBox="0 0 14 14"
      role="img"
      aria-label={label ?? STATUS_LABEL[status]}
      className={`h-3.5 w-3.5 shrink-0 ${TONE[status]} ${className}`}
    >
      {solid ? (
        <>
          <circle cx="7" cy="7" r="6" fill="currentColor" />
          <path
            d={status === "done" ? CHECK : CROSS}
            fill="none"
            stroke="rgb(var(--ui-surface))"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <circle
            cx="7"
            cy="7"
            r="5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeDasharray={status === "idle" ? "2.2 2" : undefined}
          />
          {fill > 0 && (
            <circle
              cx="7"
              cy="7"
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={RADIUS * 2}
              strokeDasharray={`${CIRCUMFERENCE * fill} ${CIRCUMFERENCE}`}
              transform="rotate(-90 7 7)"
            />
          )}
        </>
      )}
    </svg>
  );
}

/**
 * The badge that repeats a status in words.
 *
 * The surface and the text are neutral: the glyph is the only thing carrying
 * colour, so a row of badges never turns into a row of coloured pills.
 */
export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ui-border bg-ui-raised py-0.5 pl-1.5 pr-2.5 text-[11px] font-medium text-ui-text-soft">
      <StatusIcon status={status} className="h-3 w-3" />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}
