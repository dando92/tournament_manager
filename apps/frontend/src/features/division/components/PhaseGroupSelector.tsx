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
      <span className="text-xs text-ui-text-mute">
        {phaseName && <span className="font-medium text-ui-text-soft">{phaseName} / </span>}
        Pool
      </span>
      {phaseGroups.map((phaseGroup) => (
        <button
          key={phaseGroup.id}
          type="button"
          onClick={() => onSelect(phaseGroup.id)}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            phaseGroup.id === highlightedPhaseGroupId
              ? "border-ui-border-strong bg-ui-selected text-ui-text ring-2 ring-ui-border-strong"
              : phaseGroup.id === selectedPhaseGroupId
                ? "border-ui-border-strong bg-ui-selected text-ui-text"
                : "border-ui-border text-ui-text-soft hover:border-ui-border-strong hover:bg-ui-raised"
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
