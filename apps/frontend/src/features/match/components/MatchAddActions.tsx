import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserPlus } from "@fortawesome/free-solid-svg-icons";
import MusicPlusIcon from "@/shared/components/ui/MusicPlusIcon";
import { btnCreate } from "@/styles/buttonStyles";

type MatchAddActionsProps = {
  canAddSong: boolean;
  onAddPlayer: () => void;
  onAddSong: () => void;
};

/**
 * The add actions of a match, sliding out from under its table on hover.
 *
 * The wrapper animates its own row from 0fr to 1fr, so the strips take no
 * height at all until they are wanted and the table below never jumps. Hover
 * cannot be relied on below the small breakpoint, where the match actions menu
 * carries the same two actions instead.
 */
export default function MatchAddActions({ canAddSong, onAddPlayer, onAddSong }: MatchAddActionsProps) {
  return (
    <div className="hidden grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-out group-hover/match:grid-rows-[1fr] sm:grid">
      <div className="overflow-hidden">
        <div className="flex flex-col gap-1 pt-1">
          <AddStrip icon={<FontAwesomeIcon icon={faUserPlus} />} label="Add player" onClick={onAddPlayer} />
          <AddStrip icon={<MusicPlusIcon />} label="Add song" onClick={onAddSong} disabled={!canAddSong} />
        </div>
      </div>
    </div>
  );
}

type AddStripProps = {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

function AddStrip({ icon, label, onClick, disabled = false }: AddStripProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-center gap-2 rounded border px-3 py-2 text-sm ${btnCreate}`}
    >
      {icon}
      {label}
    </button>
  );
}
