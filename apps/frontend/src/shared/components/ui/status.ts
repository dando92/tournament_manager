/**
 * The vocabulary of states the interface reports.
 *
 * Kept apart from the glyph that draws them so the icon module exports nothing
 * but components, and so a caller that only needs a label does not pull in the
 * SVG.
 */
export type Status = "idle" | "running" | "pending" | "done" | "failed";

export const STATUS_LABEL: Record<Status, string> = {
  idle: "Not started",
  running: "In progress",
  pending: "Awaiting confirmation",
  done: "Completed",
  failed: "Failed",
};
