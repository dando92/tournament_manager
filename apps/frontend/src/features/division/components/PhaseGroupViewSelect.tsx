import { PhaseGroup } from "@/features/division/types/Phase";
import { formatBracketType } from "@/features/division/utils/bracketType";

type PhaseGroupViewSelectProps = {
  phaseGroup: PhaseGroup;
  disabled?: boolean;
  onChange: (bracketType: string | null) => void | Promise<void>;
};

const VIEW_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Cards" },
  { value: "RoundRobin", label: "Round robin" },
  { value: "SingleElimination", label: "Single elimination" },
  { value: "DoubleElimination", label: "Double elimination" },
];

export default function PhaseGroupViewSelect({ phaseGroup, disabled, onChange }: PhaseGroupViewSelectProps) {
  const current = phaseGroup.bracketType ?? "";
  const options = VIEW_OPTIONS.some((option) => option.value === current)
    ? VIEW_OPTIONS
    : [...VIEW_OPTIONS, { value: current, label: formatBracketType(current) ?? current }];

  return (
    <select
      title="How to display the matches of this pool"
      value={current}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || null)}
      className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
