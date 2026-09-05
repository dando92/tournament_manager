/**
 * The ITG grade ladder, and the band each rung is drawn in.
 *
 * The thresholds are ITGmania's own, read off `Themes/Simply Love/metrics.ini`
 * where every `GradePercentTierNN` carries the grade it means as a comment. The
 * four highest tiers are stars — four for a quad, then three, two and one — and
 * everything below is a letter.
 *
 * The drawing is ours. Simply Love ships these as white masks it tints on a dark
 * screen, and the theme is GPL-3.0, so nothing is copied out of it: what is
 * shared is the ladder, which is the game's rule rather than its artwork.
 *
 * `Grade_Tier00`, the quint, is missing on purpose. It is awarded on an EX score
 * of 100 — a per-judgment measurement — and a lobby reports a percentage and a
 * fail flag, so the top of this ladder is the quad.
 */

/** The six colours the ladder is drawn in, from the `score-*` scale. */
export type GradeBand = "quad" | "star" | "s" | "a" | "b" | "failed";

export type Grade =
  | { band: GradeBand; kind: "stars"; stars: number }
  | { band: GradeBand; kind: "letter"; letter: string; sign: "" | "+" | "−" };

const LETTERS: ReadonlyArray<{ from: number; letter: string; sign: "" | "+" | "−"; band: GradeBand }> = [
  { from: 94, letter: "S", sign: "+", band: "s" },
  { from: 92, letter: "S", sign: "", band: "s" },
  { from: 89, letter: "S", sign: "−", band: "s" },
  { from: 86, letter: "A", sign: "+", band: "a" },
  { from: 83, letter: "A", sign: "", band: "a" },
  { from: 80, letter: "A", sign: "−", band: "a" },
  { from: 76, letter: "B", sign: "+", band: "b" },
  { from: 72, letter: "B", sign: "", band: "b" },
  { from: 68, letter: "B", sign: "−", band: "b" },
  { from: 64, letter: "C", sign: "+", band: "b" },
  { from: 60, letter: "C", sign: "", band: "b" },
  { from: 55, letter: "C", sign: "−", band: "b" },
];

export function gradeOf(percentage: number, isFailed = false): Grade {
  if (isFailed) {
    return { band: "failed", kind: "letter", letter: "F", sign: "" };
  }
  if (percentage >= 100) {
    return { band: "quad", kind: "stars", stars: 4 };
  }
  if (percentage >= 99) {
    return { band: "star", kind: "stars", stars: 3 };
  }
  if (percentage >= 98) {
    return { band: "star", kind: "stars", stars: 2 };
  }
  if (percentage >= 96) {
    return { band: "star", kind: "stars", stars: 1 };
  }

  const rung = LETTERS.find((candidate) => percentage >= candidate.from);

  return rung
    ? { band: rung.band, kind: "letter", letter: rung.letter, sign: rung.sign }
    : { band: "b", kind: "letter", letter: "D", sign: "" };
}

/** The `score-*` step a band is drawn in. The scale was reserved for this. */
export const gradeBandText: Record<GradeBand, string> = {
  quad: "text-score-4",
  star: "text-score-3",
  s: "text-score-2",
  a: "text-score-1",
  b: "text-score-base",
  failed: "text-score-failed",
};

export const gradeBandFill: Record<GradeBand, string> = {
  quad: "bg-score-4",
  star: "bg-score-3",
  s: "bg-score-2",
  a: "bg-score-1",
  b: "bg-score-base",
  failed: "bg-score-failed",
};

/** The bands in ladder order, which is the order a stacked bar reads in. */
export const GRADE_BANDS: ReadonlyArray<{ band: GradeBand; label: string }> = [
  { band: "quad", label: "quad" },
  { band: "star", label: "star" },
  { band: "s", label: "S" },
  { band: "a", label: "A" },
  { band: "b", label: "B or below" },
  { band: "failed", label: "failed" },
];
