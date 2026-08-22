import { useState } from "react";
import OkModal from "@/shared/components/ui/OkModal";
import { Match } from "@/features/match/model/types";

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
        className="rounded-lg border border-ui-border-strong p-3 outline-none focus:border-ui-border-strong focus:ring-2 focus:ring-state-running"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={{ width: "100%", height: "200px" }}
      />
    </OkModal>
  );
}
