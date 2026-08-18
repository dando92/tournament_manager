import { useState } from "react";
import axios from "axios";
import { Tournament } from "@/features/tournament/types/Tournament";
import BaseModal from "@/shared/components/ui/BaseModal";
import { btnPrimary, btnSecondary } from "@/styles/buttonStyles";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (tournament: Tournament) => void;
};

export default function CreateTournamentModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [syncstartUrl, setSyncstartUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleClose = () => {
    setName("");
    setSyncstartUrl("");
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
      const body: { name: string; syncstartUrl?: string } = { name: trimmed };
      if (syncstartUrl.trim()) body.syncstartUrl = syncstartUrl.trim();
      const response = await axios.post<Tournament>("tournaments", body);
      setName("");
      setSyncstartUrl("");
      onCreated(response.data);
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
        <div>
          <label className="block text-sm font-medium mb-1">Syncstart Server URL</label>
          <input
            type="text"
            value={syncstartUrl}
            onChange={(e) => setSyncstartUrl(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="ws://syncservice.groovestats.com:1337"
          />
        </div>
        {apiError && <p className="text-red-500 text-sm">{apiError}</p>}
      </form>
    </BaseModal>
  );
}
