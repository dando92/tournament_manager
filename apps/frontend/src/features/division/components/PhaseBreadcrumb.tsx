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
 * Where the phases view is: the summary of every phase, or one open phase with the
 * way back, the switcher, and its actions on a single line.
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

  if (!selectedPhase) {
    const totalMatches = phases.reduce((total, phase) => total + phaseMatchCount(phase), 0);
    return (
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-700">Summary</h3>
        {phases.length > 0 && (
          <span className="text-xs text-gray-400">
            {phases.length} phase{phases.length !== 1 ? "s" : ""} &middot; {matchCountLabel(totalMatches)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onSelect("all")}
        className="flex items-center gap-1.5 rounded px-1 py-1 text-xs text-primary-dark transition-colors hover:bg-primary-dark/10"
      >
        <FontAwesomeIcon icon={faChevronLeft} className="text-[10px]" />
        All phases
      </button>
      <span className="text-xs text-gray-300">/</span>
      <PhaseMenu phases={phases} selectedPhase={selectedPhase} onSelect={onSelect} onCreate={onCreate} />
      <span className="text-xs text-gray-400">{matchCountLabel(phaseMatchCount(selectedPhase))}</span>
      {rightSlot && <div className="ml-auto flex items-center gap-2">{rightSlot}</div>}
    </div>
  );
}

type PhaseMenuProps = {
  phases: Phase[];
  selectedPhase: Phase;
  onSelect: (phaseId: number) => void;
  onCreate?: () => void;
};

function PhaseMenu({ phases, selectedPhase, onSelect, onCreate }: PhaseMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        title="Switch phase"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1.5 rounded-full border border-primary-dark bg-primary-dark/10 px-3 py-1 text-xs text-primary-dark"
      >
        {selectedPhase.name}
        <FontAwesomeIcon icon={faChevronDown} className="text-[10px]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[200px] rounded border border-gray-200 bg-white py-1 shadow-lg">
            {phases.map((phase) => (
              <button
                key={phase.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSelect(phase.id);
                }}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm ${
                  phase.id === selectedPhase.id
                    ? "bg-primary-dark/10 text-primary-dark"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {phase.name}
                <span className="text-xs text-gray-400">{matchCountLabel(phaseMatchCount(phase))}</span>
              </button>
            ))}
            {onCreate && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onCreate();
                }}
                className="mt-1 flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-left text-sm text-green-700 hover:bg-green-50"
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
