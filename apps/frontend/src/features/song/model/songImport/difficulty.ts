import type { ChartDifficulty } from "@tournament-manager/contracts";

/**
 * The six slots, and the two StepMania names that differ from them.
 *
 * A simfile says `Beginner` and `Challenge`; an ITGmania cabinet shows the
 * player `Novice` and `Expert`, and so does this application. Nothing else is
 * translated, and nothing is derived from the meter: the slot is read out of
 * the file or the chart is left out of the import.
 */
const SIMFILE_DIFFICULTIES: Record<string, ChartDifficulty> = {
  beginner: "Novice",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  challenge: "Expert",
  edit: "Edit",
};

/** The six slots, easiest first — the order a cabinet lists them in. */
export const CHART_DIFFICULTIES: ChartDifficulty[] = ["Novice", "Easy", "Medium", "Hard", "Expert", "Edit"];

/**
 * The slot a simfile difficulty names, or `null` when it names none of them.
 *
 * A guess would put a chart in a pool under a difficulty nobody wrote, so an
 * unknown value is not guessed at: the caller skips the chart and says so.
 */
export function normalizeDifficulty(value: string): ChartDifficulty | null {
  return SIMFILE_DIFFICULTIES[value.trim().toLowerCase()] ?? null;
}
