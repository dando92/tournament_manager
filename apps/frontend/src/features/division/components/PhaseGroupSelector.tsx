import { ReactNode } from "react";
import { PhaseGroup } from "@/features/division/types/Phase";
import { phaseGroupLabel } from "@/features/division/utils/phaseGroupLabel";
import CreateChip from "@/shared/components/ui/CreateChip";

type PhaseGroupSelectorProps = {
  phaseGroups: PhaseGroup[];
  selectedPhaseGroupId: number | null;
  onSelect: (phaseGroupId: number) => void;
  onCreate?: () => void;
  highlightedPhaseGroupId?: number | null;
  rightSlot?: ReactNode;
  /** Names the owning phase, for the summary where the pools of several phases are listed. */
  phaseName?: string;
};

export default function PhaseGroupSelector({
  phaseGroups,
  selectedPhaseGroupId,
  onSelect,
  onCreate,
  highlightedPhaseGroupId,
  rightSlot,
  phaseName,
}: PhaseGroupSelectorProps) {
  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <span className="text-xs text-gray-400">
        {phaseName && <span className="font-medium text-gray-600">{phaseName} / </span>}
        Pool
      </span>
      {phaseGroups.map((phaseGroup) => (
        <button
          key={phaseGroup.id}
          type="button"
          onClick={() => onSelect(phaseGroup.id)}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            phaseGroup.id === highlightedPhaseGroupId
              ? "border-green-400 bg-green-50 text-green-800 ring-2 ring-green-300"
              : phaseGroup.id === selectedPhaseGroupId
                ? "border-primary-dark bg-primary-dark/10 text-primary-dark"
                : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
          }`}
        >
          {phaseGroupLabel(phaseGroup)}
        </button>
      ))}
      {onCreate && <CreateChip title="Create pool" onClick={onCreate} />}
      {rightSlot && <div className="ml-auto flex items-center gap-2">{rightSlot}</div>}
    </div>
  );
}
