import { useState } from "react";
import { toast } from "react-toastify";
import { faPenToSquare, faTrash } from "@fortawesome/free-solid-svg-icons";
import RenamePhaseModal from "@/features/division/modals/RenamePhaseModal";
import { updatePhase } from "@/features/division/services/phases.api";
import { Phase } from "@/features/division/types/Phase";
import ActionsMenu from "@/shared/components/ui/ActionsMenu";

type PhaseActionsMenuProps = {
  phase: Phase;
  onDelete: () => void | Promise<void>;
  onChanged?: () => Promise<void>;
  align?: "left" | "right";
};

export default function PhaseActionsMenu({ phase, onDelete, onChanged, align = "right" }: PhaseActionsMenuProps) {
  const [renaming, setRenaming] = useState(false);

  const rename = async (name: string) => {
    try {
      await updatePhase(phase.id, { name });
      await onChanged?.();
      toast.success("Phase renamed.");
    } catch {
      toast.error("Error renaming phase.");
    }
  };

  return (
    <>
      <ActionsMenu
        title="Phase actions"
        align={align}
        items={[
          {
            key: "rename",
            label: "Rename phase",
            icon: faPenToSquare,
            onSelect: () => setRenaming(true),
          },
          {
            key: "delete",
            label: "Delete phase",
            icon: faTrash,
            danger: true,
            onSelect: onDelete,
            confirm: {
              message: `Delete phase "${phase.name}"? Its pools and their matches are deleted with it, and this cannot be undone.`,
              confirmText: "Delete phase",
            },
          },
        ]}
      />
      <RenamePhaseModal
        open={renaming}
        currentName={phase.name}
        onClose={() => setRenaming(false)}
        onRename={rename}
      />
    </>
  );
}
