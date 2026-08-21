import { faTrash } from "@fortawesome/free-solid-svg-icons";
import ActionsMenu from "@/shared/components/ui/ActionsMenu";
import { Phase } from "@/features/division/types/Phase";

type PhaseActionsMenuProps = {
  phase: Phase;
  onDelete: () => void | Promise<void>;
  align?: "left" | "right";
};

export default function PhaseActionsMenu({ phase, onDelete, align = "right" }: PhaseActionsMenuProps) {
  return (
    <ActionsMenu
      title="Phase actions"
      align={align}
      items={[
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
  );
}
