import type { ChartDifficulty } from "@tournament-manager/contracts";

/**
 * How a difficulty slot is drawn, decided once.
 *
 * The label is the word a player reads on the cabinet and the colour is the
 * one the cabinet gives that slot, so both belong to the domain rather than to
 * any component that happens to show a chart. The values are the `chart-*`
 * tokens; nothing here hard-codes a hex.
 */
export const chartDifficultyPresentation: Record<
  ChartDifficulty,
  { label: string; badge: string; text: string; border: string }
> = {
  Novice: { label: "Novice", badge: "bg-chart-novice", text: "text-chart-novice", border: "border-chart-novice" },
  Easy: { label: "Easy", badge: "bg-chart-easy", text: "text-chart-easy", border: "border-chart-easy" },
  Medium: { label: "Medium", badge: "bg-chart-medium", text: "text-chart-medium", border: "border-chart-medium" },
  Hard: { label: "Hard", badge: "bg-chart-hard", text: "text-chart-hard", border: "border-chart-hard" },
  Expert: { label: "Expert", badge: "bg-chart-expert", text: "text-chart-expert", border: "border-chart-expert" },
  Edit: { label: "Edit", badge: "bg-chart-edit", text: "text-chart-edit", border: "border-chart-edit" },
};

/**
 * The ordinal ramp a song without a slot falls back to.
 *
 * Songs added by hand state a meter and nothing else. They keep the ranked
 * scale the list has always drawn them in rather than borrowing a slot colour
 * that would claim something the row does not know.
 */
export function meterStep(difficulty: number): 1 | 2 | 3 | 4 | 5 {
  if (difficulty <= 3) return 1;
  if (difficulty <= 6) return 2;
  if (difficulty <= 9) return 3;
  if (difficulty <= 12) return 4;

  return 5;
}

/*
 * Both tables spell their classes out. Tailwind scans the source for literal
 * class names, so a template literal built from the step would generate nothing
 * and every meter would come out unstyled.
 */
const METER_BACKGROUND = ["bg-difficulty-1", "bg-difficulty-2", "bg-difficulty-3", "bg-difficulty-4", "bg-difficulty-5"];
const METER_FILL = ["fill-difficulty-1", "fill-difficulty-2", "fill-difficulty-3", "fill-difficulty-4", "fill-difficulty-5"];

export function meterColor(difficulty: number): string {
  return METER_BACKGROUND[meterStep(difficulty) - 1];
}

/** The same step as a fill, for a mark drawn in SVG rather than as a box. */
export function meterFill(difficulty: number): string {
  return METER_FILL[meterStep(difficulty) - 1];
}
