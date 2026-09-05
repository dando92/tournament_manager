import type { DivisionPlacementsDto } from "@tournament-manager/contracts";

import StatusIcon from "@/shared/components/ui/StatusIcon";
import type { Status } from "@/shared/components/ui/status";

/**
 * Which division the placements are being read for.
 *
 * Tabs rather than a dropdown, because which divisions have finished is itself
 * information: the glyph says whether there is a final order behind the tab
 * before anybody opens it. A division nobody has played is idle, one still being
 * played is running, and one that is finished carries the check.
 */
function divisionStatus(division: DivisionPlacementsDto): Status {
  if (division.complete) {
    return "done";
  }

  return division.rows.length > 0 ? "running" : "idle";
}

export default function DivisionTabs({
  divisions,
  selectedId,
  onSelect,
}: {
  divisions: DivisionPlacementsDto[];
  selectedId: number | null;
  onSelect: (divisionId: number) => void;
}) {
  const finished = divisions.filter((division) => division.complete).length;

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-ui-border pb-0.5">
      {divisions.map((division) => {
        const selected = division.divisionId === selectedId;

        return (
          <button
            key={division.divisionId}
            type="button"
            onClick={() => onSelect(division.divisionId)}
            className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              selected
                ? "border-ui-border bg-ui-surface text-ui-text shadow-[inset_0_-3px_0_0_rgb(var(--ui-accent))]"
                : "border-transparent text-ui-text-mute hover:text-ui-text"
            }`}
            aria-pressed={selected}
          >
            <StatusIcon status={divisionStatus(division)} className="h-3 w-3" />
            {division.divisionName}
          </button>
        );
      })}
      <span className="ml-auto shrink-0 pl-3 pr-0.5 text-xs text-ui-text-mute">
        {finished} of {divisions.length} division{divisions.length === 1 ? "" : "s"} finished
      </span>
    </div>
  );
}
