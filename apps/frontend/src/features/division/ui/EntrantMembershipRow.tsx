import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGripVertical, faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";
import { DraggableProvidedDragHandleProps } from "react-beautiful-dnd";
import { btnCreateIcon } from "@/styles/buttonStyles";

type EntrantMembershipRowProps = {
  name: string;
  present: boolean;
  canEdit: boolean;
  saving?: boolean;
  seedNumber?: number | null;
  editingSeeding?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  onAdd?: () => void;
  onRemove?: () => void;
};

export default function EntrantMembershipRow({
  name,
  present,
  canEdit,
  saving = false,
  seedNumber = null,
  editingSeeding = false,
  dragHandleProps,
  onAdd,
  onRemove,
}: EntrantMembershipRowProps) {
  return (
    <div className="flex items-center justify-between bg-ui-raised px-3 py-2 rounded text-sm">
      <div className="flex min-w-0 items-center gap-3">
        {seedNumber !== null && seedNumber !== undefined && (
          <span className="w-8 text-xs font-bold text-ui-text-mute">#{seedNumber}</span>
        )}
        <span className={`truncate ${present ? "" : "text-ui-text-mute"}`}>{name}</span>
      </div>
      {canEdit && (
        editingSeeding ? (
          present && dragHandleProps ? (
            <button
              type="button"
              {...dragHandleProps}
              disabled={saving}
              className="cursor-grab text-ui-text-mute hover:text-ui-text-soft ml-2 disabled:opacity-50"
              title="Reorder seeding"
            >
              <FontAwesomeIcon icon={faGripVertical} />
            </button>
          ) : null
        ) : present ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={saving}
            className="text-state-failed hover:text-state-failed ml-2 disabled:opacity-50"
            title="Remove"
          >
            <FontAwesomeIcon icon={faMinus} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            disabled={saving}
            className={`ml-2 ${btnCreateIcon}`}
            title="Add"
          >
            <FontAwesomeIcon icon={faPlus} />
          </button>
        )
      )}
    </div>
  );
}
