import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGripVertical, faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";
import { DraggableProvidedDragHandleProps } from "react-beautiful-dnd";

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
    <div className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-sm">
      <div className="flex min-w-0 items-center gap-3">
        {seedNumber !== null && seedNumber !== undefined && (
          <span className="w-8 text-xs font-bold text-primary-dark">#{seedNumber}</span>
        )}
        <span className={`truncate ${present ? "" : "text-gray-500"}`}>{name}</span>
      </div>
      {canEdit && (
        editingSeeding ? (
          present && dragHandleProps ? (
            <button
              type="button"
              {...dragHandleProps}
              disabled={saving}
              className="cursor-grab text-gray-400 hover:text-gray-600 ml-2 disabled:opacity-50"
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
            className="text-red-500 hover:text-red-700 ml-2 disabled:opacity-50"
            title="Remove"
          >
            <FontAwesomeIcon icon={faMinus} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            disabled={saving}
            className="text-green-700 hover:text-green-900 ml-2 disabled:opacity-50"
            title="Add"
          >
            <FontAwesomeIcon icon={faPlus} />
          </button>
        )
      )}
    </div>
  );
}
