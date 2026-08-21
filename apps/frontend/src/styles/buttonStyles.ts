/*
 * Button treatments.
 *
 * Hierarchy is carried by surface and weight, not by hue: the primary action is
 * a raised surface with a stronger border, not a block of colour. The only
 * button that keeps a hue is the destructive one, because "this cannot be
 * undone" is a meaning rather than a rank.
 *
 * The focus ring is the one place the brand colour appears on an action.
 */

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-state-running focus-visible:ring-offset-2 focus-visible:ring-offset-ui-canvas";

/** Primary — main CTA */
export const btnPrimary = `rounded border border-ui-border-strong bg-ui-raised px-3 py-2 font-semibold text-ui-text transition-colors hover:bg-ui-selected disabled:opacity-50 ${FOCUS}`;

/** Secondary — secondary actions */
export const btnSecondary = `rounded border border-ui-border bg-ui-surface px-3 py-2 text-ui-text-soft transition-colors hover:bg-ui-raised hover:text-ui-text disabled:opacity-50 ${FOCUS}`;

/** Danger — destructive with border (no solid fill) */
export const btnDanger = `rounded border border-state-failed/40 px-3 py-2 text-state-failed transition-colors hover:bg-state-failed/10 disabled:opacity-50 ${FOCUS}`;

/** Ghost — low-emphasis tertiary */
export const btnGhost = `rounded px-3 py-2 text-ui-text-soft transition-colors hover:bg-ui-raised hover:text-ui-text disabled:opacity-50 ${FOCUS}`;

/** Trash — icon-only delete */
export const btnTrash =
  "inline-flex items-center justify-center rounded p-2 -m-1 text-ui-text-mute transition-colors hover:bg-state-failed/10 hover:text-state-failed disabled:opacity-50";

/**
 * Create — the dashed slot that stands in for an item that does not exist yet.
 *
 * The dashed outline is what says "empty, fill me": it survives greyscale and
 * colour blindness, so creation needs neither a hue nor an emphasis of its own.
 * Callers add their own border width and radius.
 */
export const btnCreate = `border-dashed border-ui-border-strong text-ui-text-soft transition-colors hover:bg-ui-raised hover:text-ui-text disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

/** Create icon — icon-only "+" affordance inside dense rows and toolbars. */
export const btnCreateIcon =
  "text-ui-text-mute transition-colors hover:text-ui-text disabled:cursor-not-allowed disabled:opacity-50";
