import { percentage } from "@/features/stats/model/statsFormat";
import GradeMark from "@/features/stats/ui/GradeMark";

/**
 * A percentage and the grade it earned, in one column that stays a column.
 *
 * The grade is the reason this exists: four stars are five times as wide as an
 * `A`, so a percentage placed before a bare mark moves from row to row and the
 * decimal points stop lining up. The mark gets a fixed slot wide enough for the
 * widest grade there is, and reads from the left inside it; the percentage ends
 * where every other percentage ends.
 */
export default function ScoreWithGrade({ value, isFailed = false }: { value: number | null; isFailed?: boolean }) {
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="font-semibold tabular-nums text-ui-text">{percentage(value)}</span>
      <span className="flex w-14 shrink-0 justify-start">
        <GradeMark percentage={value} isFailed={isFailed} />
      </span>
    </span>
  );
}
