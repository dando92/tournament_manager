import type { GradeMixDto } from "@tournament-manager/contracts";

import { GRADE_BANDS, gradeBandFill } from "@/features/stats/model/grade";

/**
 * Where a set of runs fell across the grade ladder.
 *
 * The bar is what an average cannot say: two players on ninety-one per cent are
 * a steady one and one alternating stars with fails, and only this separates
 * them. Read the same way under a song, it says whether the song was hard or
 * merely long.
 */
export default function GradeMixBar({ grades, label }: { grades: GradeMixDto; label: string }) {
  const segments = GRADE_BANDS.map((band) => ({ ...band, count: grades[band.band] }));
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);

  if (total === 0) {
    return <span className="text-xs text-ui-text-mute">—</span>;
  }

  return (
    <span className="flex h-2 overflow-hidden rounded-sm" title={`${label}: ${segments.filter((s) => s.count).map((s) => `${s.count} ${s.label}`).join(", ")}`}>
      {segments
        .filter((segment) => segment.count > 0)
        .map((segment) => (
          <span key={segment.band} className={gradeBandFill[segment.band]} style={{ width: `${(segment.count / total) * 100}%` }} />
        ))}
    </span>
  );
}

/** The legend the bar is read with, shown once above a table rather than per row. */
export function GradeMixLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-ui-text-mute">
      <span className="font-semibold uppercase tracking-wide">Grade mix</span>
      {GRADE_BANDS.map((band) => (
        <span key={band.band} className="inline-flex items-center gap-1">
          <span className={`h-2 w-2 rounded-sm ${gradeBandFill[band.band]}`} />
          {band.label}
        </span>
      ))}
    </div>
  );
}
