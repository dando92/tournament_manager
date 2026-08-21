import { useEffect, useState } from "react";
import OkModal from "@/shared/components/ui/OkModal";

type RenamePhaseModalProps = {
  open: boolean;
  currentName: string;
  onClose: () => void;
  onRename: (name: string) => void;
};

export default function RenamePhaseModal({ open, currentName, onClose, onRename }: RenamePhaseModalProps) {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    if (open) setName(currentName);
  }, [currentName, open]);

  const onSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) {
      onClose();
      return;
    }
    onRename(trimmed);
    onClose();
  };

  return (
    <OkModal title="Rename Phase" okText="Rename phase" open={open} onClose={onClose} onOk={onSubmit}>
      <div className="w-full">
        <h3 className="mb-1">Name</h3>
        <input
          className="w-full border border-gray-300 px-2 py-2 rounded-lg"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Phase name"
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Enter") onSubmit();
          }}
        />
      </div>
    </OkModal>
  );
}
