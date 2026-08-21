import { ReactNode, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronLeft, faPlus } from "@fortawesome/free-solid-svg-icons";
import { Phase } from "@/features/division/types/Phase";
import { matchCountLabel, phaseMatchCount } from "@/features/division/utils/phaseMatchCount";

type PhaseBreadcrumbProps = {
  phases: Phase[];
  selectedPhaseId: number | "all";
  onSelect: (phaseId: number | "all") => void;
  onCreate?: () => void;
  /** Phase-level actions, shown at the end of the line while a single phase is open. */
  rightSlot?: ReactNode;
};

/**
 * Where the phases view is and how to move inside it: the way back to the summary,
 * the switcher over every phase, what it holds, and its actions on a single line.
 */
export default function PhaseBreadcrumb({
  phases,
  selectedPhaseId,
  onSelect,
  onCreate,
  rightSlot,
}: PhaseBreadcrumbProps) {
  const selectedPhase =
    typeof selectedPhaseId === "number" ? phases.find((phase) => phase.id === selectedPhaseId) ?? null : null;
  const totalMatches = phases.reduce((total, phase) => total + phaseMatchCount(phase), 0);

  return (
    <div className="flex items-center gap-2">
      {selectedPhase && (
        <>
          <button
            type="button"
            onClick={() => onSelect("all")}
            className="flex items-center gap-1.5 rounded px-1 py-1 text-xs text-brand-700 transition-colors hover:bg-brand-50"
          >
            <FontAwesomeIcon icon={faChevronLeft} className="text-[10px]" />
            All phases
          </button>
          <span className="text-xs text-gray-300">/</span>
        </>
      )}
      <PhaseMenu phases={phases} selectedPhase={selectedPhase} onSelect={onSelect} onCreate={onCreate} />
      <span className="text-xs text-gray-500">
        {selectedPhase
          ? matchCountLabel(phaseMatchCount(selectedPhase))
          : phases.length > 0 &&
            `${phases.length} phase${phases.length !== 1 ? "s" : ""} · ${matchCountLabel(totalMatches)}`}
      </span>
      {rightSlot && <div className="ml-auto flex items-center gap-2">{rightSlot}</div>}
    </div>
  );
}

type PhaseMenuProps = {
  phases: Phase[];
  selectedPhase: Phase | null;
  onSelect: (phaseId: number | "all") => void;
  onCreate?: () => void;
};

function PhaseMenu({ phases, selectedPhase, onSelect, onCreate }: PhaseMenuProps) {
  const [open, setOpen] = useState(false);

  const choose = (phaseId: number | "all") => {
    setOpen(false);
    onSelect(phaseId);
  };

  return (
    <div className="relative">
      <button
        type="button"
        title="Switch phase"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1.5 rounded-full border border-brand-700 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
      >
        {selectedPhase?.name ?? "Summary"}
        <FontAwesomeIcon icon={faChevronDown} className="text-[10px]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[220px] rounded border border-gray-200 bg-white py-1 shadow-lg">
            <MenuItem label="Summary" hint="All phases" selected={!selectedPhase} onSelect={() => choose("all")} />
            {phases.map((phase) => (
              <MenuItem
                key={phase.id}
                label={phase.name}
                hint={matchCountLabel(phaseMatchCount(phase))}
                selected={phase.id === selectedPhase?.id}
                onSelect={() => choose(phase.id)}
              />
            ))}
            {onCreate && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onCreate();
                }}
                className="mt-1 flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-left text-sm text-brand-700 hover:bg-brand-50"
              >
                <FontAwesomeIcon icon={faPlus} />
                New phase
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

type MenuItemProps = {
  label: string;
  hint: string;
  selected: boolean;
  onSelect: () => void;
};

function MenuItem({ label, hint, selected, onSelect }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm ${
        selected ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"
      }`}
    >
      {label}
      <span className="text-xs text-gray-500">{hint}</span>
    </button>
  );
}
