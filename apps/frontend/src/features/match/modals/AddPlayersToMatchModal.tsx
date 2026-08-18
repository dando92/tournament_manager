import { useMemo, useState } from "react";
import { Entrant } from "@/features/entrant/types/Entrant";
import BaseModal from "@/shared/components/ui/BaseModal";
import MultiSelect from "@/shared/components/ui/MultiSelect";
import { btnPrimary, btnSecondary } from "@/styles/buttonStyles";

type AddPlayersToMatchModalProps = {
  open: boolean;
  divisionEntrants: Entrant[];
  matchEntrants: Entrant[];
  onClose: () => void;
  onAddPlayers: (entrantIds: number[]) => Promise<void>;
};

export default function AddPlayersToMatchModal({
  open,
  divisionEntrants,
  matchEntrants,
  onClose,
  onAddPlayers,
}: AddPlayersToMatchModalProps) {
  const [selectedEntrantIds, setSelectedEntrantIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const matchEntrantIds = useMemo(
    () => new Set(matchEntrants.map((entrant) => entrant.id)),
    [matchEntrants],
  );
  const availableEntrants = useMemo(
    () =>
      divisionEntrants
        .filter((entrant) => entrant.status === "active" && entrant.type === "player")
        .filter((entrant) => !matchEntrantIds.has(entrant.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [divisionEntrants, matchEntrantIds],
  );
  const entrantOptions = useMemo(
    () => availableEntrants.map((entrant) => ({ value: entrant.id, label: entrant.name })),
    [availableEntrants],
  );
  const selectedEntrantOptions = useMemo(
    () =>
      selectedEntrantIds
        .map((entrantId) => entrantOptions.find((option) => option.value === entrantId))
        .filter((option): option is { value: number; label: string } => Boolean(option)),
    [entrantOptions, selectedEntrantIds],
  );

  async function handleAddPlayers() {
    setSubmitting(true);
    try {
      await onAddPlayers([...matchEntrants.map((entrant) => entrant.id), ...selectedEntrantIds]);
      setSelectedEntrantIds([]);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BaseModal open={open} onClose={onClose} title="Add players to match" maxWidth="max-w-md">
      <div className="flex flex-col gap-3">
        {availableEntrants.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No available players.</p>
        ) : (
          <MultiSelect
            options={entrantOptions}
            value={selectedEntrantOptions}
            onChange={(selected) => setSelectedEntrantIds(selected.map((option) => option.value))}
            placeholder="Select players..."
          />
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${btnSecondary} text-sm`}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAddPlayers}
            disabled={submitting || selectedEntrantIds.length === 0}
            className={`${btnPrimary} text-sm disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {submitting ? "Adding..." : "Add selected"}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
