import { Phase } from "@/features/division/types/Phase";

type PhaseSelectorProps = {
  phases: Phase[];
  selectedPhaseId: number | "all";
  onSelect: (phaseId: number | "all") => void;
};

export default function PhaseSelector({
  phases,
  selectedPhaseId,
  onSelect,
}: PhaseSelectorProps) {
  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-2 min-w-max pb-1">
        <PhaseButton
          label="Summary"
          sublabel="All phases"
          selected={selectedPhaseId === "all"}
          onClick={() => onSelect("all")}
        />
        {phases.map((phase) => (
          (() => {
            const matchCount = phase.matchCount ?? phase.matches?.length ?? 0;
            return (
          <PhaseButton
            key={phase.id}
            label={phase.name}
            sublabel={`${matchCount} match${matchCount !== 1 ? "es" : ""}`}
            selected={selectedPhaseId === phase.id}
            onClick={() => onSelect(phase.id)}
          />
            );
          })()
        ))}
      </div>
    </div>
  );
}

type PhaseButtonProps = {
  label: string;
  sublabel?: string;
  selected: boolean;
  onClick: () => void;
};

function PhaseButton({ label, sublabel, selected, onClick }: PhaseButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start w-32 px-3 py-1.5 rounded border text-left transition-colors text-xs ${
        selected
          ? "border-primary-dark bg-primary-dark/10 text-primary-dark"
          : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <span className={`font-medium ${selected ? "text-primary-dark" : "text-gray-700"}`}>{label}</span>
      {sublabel && <span className="text-gray-400">{sublabel}</span>}
    </button>
  );
}
