import { PoolViewMode } from "@/shared/lib/poolViewMode";
import Select from "@/shared/components/ui/Select";

type PhaseGroupViewSelectProps = {
  mode: PoolViewMode;
  options: PoolViewMode[];
  onChange: (mode: PoolViewMode) => void;
};

const VIEW_LABELS: Record<PoolViewMode, string> = {
  raw: "Cards",
  roundRobin: "Round robin",
  bracket: "Bracket",
};

export default function PhaseGroupViewSelect({ mode, options, onChange }: PhaseGroupViewSelectProps) {
  if (options.length < 2) return null;

  return (
    <Select
      variant="compact"
      title="How to display the matches of this pool on this device"
      value={mode}
      onChange={(event) => onChange(event.target.value as PoolViewMode)}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {VIEW_LABELS[option]}
        </option>
      ))}
    </Select>
  );
}
