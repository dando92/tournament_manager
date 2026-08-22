import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGripVertical, faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";
import { btnCreateIcon } from "@/styles/buttonStyles";

type EntrantMembershipRowProps = {
  name: string;
  present: boolean;
  canEdit: boolean;
  saving?: boolean;
  seedNumber?: number | null;
  /**
   * Draws the grip and the grab cursor. The row itself is the drag handle, so
   * this says what is possible rather than doing it: a grip small enough to aim
   * at is a worse target than the whole line it sits on.
   */
  draggable?: boolean;
  dragging?: boolean;
  onAdd?: () => void;
  onRemove?: () => void;
};

export default function EntrantMembershipRow({
  name,
  present,
  canEdit,
  saving = false,
  seedNumber = null,
  draggable = false,
  dragging = false,
  onAdd,
  onRemove,
}: EntrantMembershipRowProps) {
  return (
    <div
      className={`flex items-center justify-between rounded px-3 py-2 text-sm transition-colors ${
        dragging ? "bg-ui-selected shadow-md" : "bg-ui-raised"
      } ${draggable ? "cursor-grab hover:bg-ui-selected active:cursor-grabbing" : ""}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {seedNumber !== null && seedNumber !== undefined && (
          <span className="w-8 text-xs font-bold tabular-nums text-ui-text-mute">#{seedNumber}</span>
        )}
        <span className={`truncate ${present ? "" : "text-ui-text-mute"}`}>{name}</span>
      </div>
      {draggable && <FontAwesomeIcon icon={faGripVertical} aria-hidden className="ml-2 shrink-0 text-ui-text-mute" />}
      {!draggable && canEdit && present && (
        <button
          type="button"
          onClick={onRemove}
          disabled={saving}
          className="ml-2 text-state-failed hover:text-state-failed disabled:opacity-50"
          title="Remove"
        >
          <FontAwesomeIcon icon={faMinus} />
        </button>
      )}
      {!draggable && canEdit && !present && (
        <button
          type="button"
          onClick={onAdd}
          disabled={saving}
          className={`ml-2 ${btnCreateIcon}`}
          title="Add"
        >
          <FontAwesomeIcon icon={faPlus} />
        </button>
      )}
    </div>
  );
}
