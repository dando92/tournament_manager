import { useState } from "react";
import OkModal from "@/shared/components/ui/OkModal";
import { Match } from "@/features/match/types/Match";

type EditMatchNotesModalProps = {
  open: boolean;
  match: Match;
  onClose: () => void;
  onSave: (matchId: number, notes: string) => void;
};

export default function EditMatchNotesModal({
  open,
  match,
  onClose,
  onSave,
}: EditMatchNotesModalProps) {
  const [notes, setNotes] = useState(match.notes || "");

  const handleSave = () => {
    onSave(match.id, notes);
    onClose();
  };

  return (
    <OkModal
      title={`Edit notes for match ${match.name}`}
      onClose={onClose}
      onOk={handleSave}
      open={open}
    >
      <textarea
        className="rounded-lg border border-gray-300 p-3 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={{ width: "100%", height: "200px" }}
      />
    </OkModal>
  );
}
