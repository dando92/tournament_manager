import { useEffect, useMemo, useState } from "react";
import { Player } from "@/features/player/types/Player";
import { getAllPlayers } from "@/features/player/services/player.api";
import { btnPrimary, btnSecondary } from "@/styles/buttonStyles";
import BaseModal from "@/shared/components/ui/BaseModal";
import MultiSelect from "@/shared/components/ui/MultiSelect";

type Props = {
  open: boolean;
  currentPlayerIds: Set<number>;
  onAssign: (playerId: number, player: Player) => Promise<void>;
  onClose: () => void;
};

export default function AddPlayerModal({ open, currentPlayerIds, onAssign, onClose }: Props) {
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setSelectedPlayerIds([]);
    getAllPlayers()
      .then(setAllPlayers)
      .finally(() => setLoading(false));
  }, [open]);

  const availablePlayers = useMemo(
    () =>
      allPlayers
        .filter((player) => !currentPlayerIds.has(player.id))
        .sort((a, b) => a.playerName.localeCompare(b.playerName)),
    [allPlayers, currentPlayerIds],
  );
  const availablePlayerOptions = useMemo(
    () => availablePlayers.map((player) => ({ value: player.id, label: player.playerName })),
    [availablePlayers],
  );
  const selectedPlayerOptions = useMemo(
    () =>
      selectedPlayerIds
        .map((playerId) => availablePlayerOptions.find((option) => option.value === playerId))
        .filter((option): option is { value: number; label: string } => Boolean(option)),
    [availablePlayerOptions, selectedPlayerIds],
  );

  async function handleAssignSelected() {
    setAssigning(true);
    try {
      const selectedPlayers = selectedPlayerIds
        .map((playerId) => availablePlayers.find((player) => player.id === playerId))
        .filter((player): player is Player => Boolean(player));

      for (const player of selectedPlayers) {
        await onAssign(player.id, player);
      }

      onClose();
    } finally {
      setAssigning(false);
    }
  }

  return (
    <BaseModal open={open} onClose={onClose} title="Add player to division" maxWidth="max-w-md">
      <div className="flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-gray-400 italic py-2">Loading players...</p>
        ) : availablePlayers.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-2">No players found.</p>
        ) : (
          <MultiSelect
            options={availablePlayerOptions}
            value={selectedPlayerOptions}
            onChange={(selected) => setSelectedPlayerIds(selected.map((option) => option.value))}
            placeholder="Select players..."
          />
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${btnSecondary} text-sm`}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAssignSelected}
            disabled={assigning || selectedPlayerIds.length === 0}
            className={`${btnPrimary} text-sm disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {assigning ? "Adding..." : "Add selected"}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
