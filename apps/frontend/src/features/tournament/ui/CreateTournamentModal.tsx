import { useState } from "react";
import { TournamentRef } from "@/features/tournament/model/types";
import { createTournament } from "@/features/tournament/api/tournament.api";
import BaseModal from "@/shared/components/ui/BaseModal";
import { btnPrimary, btnSecondary } from "@/styles/buttonStyles";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (tournament: TournamentRef) => void;
};

export default function CreateTournamentModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleClose = () => {
    setName("");
    setApiError(null);
    onClose();
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setApiError(null);
    setLoading(true);
    try {
      /* The creation answers with an id and nothing else, and the name is the
         one this form just sent, so the two together are the whole reference. */
      const id = await createTournament(trimmed);
      setName("");
      onCreated({ id, name: trimmed });
    } catch {
      setApiError("Failed to create tournament.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <BaseModal
      open={open}
      onClose={handleClose}
      title="New Tournament"
      maxWidth="max-w-md"
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            className={`flex-1 ${btnSecondary}`}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-tournament-form"
            disabled={loading || !name.trim()}
            className={`flex-1 ${btnPrimary} font-semibold`}
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </div>
      }
    >
      <form id="create-tournament-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Tournament Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="e.g. Euro Cup 2026"
            autoFocus
            required
          />
        </div>
        <p className="text-sm text-ui-text-mute">
          Syncstart, start.gg and scoring settings are configured after creation in the
          tournament configuration page.
        </p>
        {apiError && <p className="text-state-failed text-sm">{apiError}</p>}
      </form>
    </BaseModal>
  );
}
