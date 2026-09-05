import type { DivisionPlacementsDto } from "@tournament-manager/contracts";

/**
 * Which division's final order is being read.
 *
 * Only the finished ones are listed. A division still being played has no order
 * to show, and a tab that opens onto "this is still under way" is a tab that
 * wasted somebody's click — a row of eight of them around the one division that
 * has an answer is worse than no row at all. How many are still going is said
 * once, at the end, as context rather than as eight destinations.
 */
export default function DivisionTabs({
  divisions,
  unfinished,
  selectedId,
  onSelect,
}: {
  divisions: DivisionPlacementsDto[];
  unfinished: number;
  selectedId: number | null;
  onSelect: (divisionId: number) => void;
}) {
  if (divisions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-ui-border pb-1">
      {divisions.map((division) => {
        const selected = division.divisionId === selectedId;

        return (
          <button
            key={division.divisionId}
            type="button"
            onClick={() => onSelect(division.divisionId)}
            aria-pressed={selected}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              selected
                ? "border-ui-border bg-ui-surface text-ui-text shadow-[inset_0_-3px_0_0_rgb(var(--ui-accent))]"
                : "border-transparent text-ui-text-mute hover:text-ui-text"
            }`}
          >
            {division.divisionName}
            <span className="text-xs font-normal tabular-nums text-ui-text-mute">{division.rows.length}</span>
          </button>
        );
      })}
      {unfinished > 0 ? (
        <span className="ml-auto pl-3 text-xs text-ui-text-mute">
          {unfinished} division{unfinished === 1 ? "" : "s"} still under way
        </span>
      ) : null}
    </div>
  );
}
