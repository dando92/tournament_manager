import { useEffect, useState } from "react";
import OkModal from "@/shared/components/ui/OkModal";

/**
 * Renaming anything the tree holds.
 *
 * One dialog rather than one per kind: the only thing that changes between a
 * division, a phase and a pool is the noun in the title.
 */

type RenameModalProps = {
  open: boolean;
  /** The kind being renamed, lower case — "phase", "pool", "division". */
  noun: string;
  currentName: string;
  onClose: () => void;
  onRename: (name: string) => void;
};

export default function RenameModal({ open, noun, currentName, onClose, onRename }: RenameModalProps) {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    if (open) setName(currentName);
  }, [currentName, open]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) {
      onClose();
      return;
    }
    onRename(trimmed);
    onClose();
  };

  return (
    <OkModal title={`Rename ${noun}`} okText={`Rename ${noun}`} open={open} onClose={onClose} onOk={submit}>
      <div className="w-full">
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          className="w-full rounded border border-ui-border-strong bg-ui-surface px-3 py-2 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-state-running"
          placeholder={`${noun.charAt(0).toUpperCase()}${noun.slice(1)} name`}
        />
      </div>
    </OkModal>
  );
}
