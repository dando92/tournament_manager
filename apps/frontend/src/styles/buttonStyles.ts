/** Primary — main CTA */
export const btnPrimary =
  "bg-brand-700 text-white px-3 py-2 rounded hover:bg-brand-700/90 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-50";

/** Secondary — secondary actions */
export const btnSecondary =
  "border border-brand-700 text-brand-700 px-3 py-2 rounded hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-50";

/** Danger — destructive with border (no solid fill) */
export const btnDanger =
  "border border-red-300 text-red-600 px-3 py-2 rounded hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:opacity-50";

/** Ghost — low-emphasis tertiary */
export const btnGhost =
  "text-brand-700 px-3 py-2 rounded hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-50";

/** Trash — icon-only delete */
export const btnTrash =
  "inline-flex items-center justify-center rounded p-2 -m-1 text-red-600 hover:bg-red-50 hover:text-red-800 disabled:opacity-50";

/**
 * Create — the dashed slot that stands in for an item that does not exist yet.
 *
 * The dashed outline is what says "empty, fill me": it survives greyscale and
 * colour blindness, so creation does not need a hue of its own. The brand tint
 * only marks the slot as interactive. Callers add their own border width and
 * radius.
 */
export const btnCreate =
  "border-dashed border-gray-300 text-brand-700 transition-colors hover:border-brand-400 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/** Create icon — icon-only "+" affordance inside dense rows and toolbars. */
export const btnCreateIcon =
  "text-brand-700 transition-colors hover:text-brand-900 disabled:cursor-not-allowed disabled:opacity-50";
