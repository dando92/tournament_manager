import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faUserPlus } from "@fortawesome/free-solid-svg-icons";
import MusicPlusIcon from "@/shared/components/ui/MusicPlusIcon";
import { btnCreate } from "@/styles/buttonStyles";

/**
 * What an empty match looks like: the table it is about to become.
 *
 * "No match data available" said nothing about how to fix it. A skeleton with a
 * dashed column where a song goes and a dashed row where a player goes teaches
 * the shape of a match at the moment someone needs to learn it — players are
 * rows, songs are columns — and the affordance sits exactly where the thing it
 * creates will appear.
 *
 * The dash is doing its proper job here, enclosing an area to fill. That is why
 * the same two actions are ordinary buttons once the match has content: there
 * is no empty slot left to outline.
 */

type MatchEmptySlotsProps = {
  canAddSong: boolean;
  onAddSong: () => void;
  onAddPlayer: () => void;
};

export default function MatchEmptySlots({ canAddSong, onAddSong, onAddPlayer }: MatchEmptySlotsProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-ui-border shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-ui-raised text-[10px] uppercase tracking-wider text-ui-text-mute">
            <th className="w-[120px] px-3 py-2.5 text-left font-semibold sm:w-[160px]">Player</th>
            <th className="px-2 py-2">
              <button
                type="button"
                onClick={onAddSong}
                disabled={!canAddSong}
                title={canAddSong ? "Add the first song" : "Add a player before adding a song"}
                className={`flex w-full items-center justify-center gap-2 rounded border-2 px-3 py-1.5 text-xs font-medium normal-case tracking-normal ${btnCreate}`}
              >
                <MusicPlusIcon />
                Add song
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={2} className="px-2 py-2">
              <button
                type="button"
                onClick={onAddPlayer}
                className={`flex w-full items-center justify-center gap-2 rounded border-2 px-3 py-3 text-sm font-medium ${btnCreate}`}
              >
                <FontAwesomeIcon icon={faUserPlus} />
                Add player
              </button>
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="px-3 pb-3 text-center text-xs text-ui-text-mute">
              Players are rows, songs are columns. Add both, then fill in the scores.
              <span className="mt-1 block">
                No songs? Turn on <FontAwesomeIcon icon={faPlus} className="mx-0.5 text-[9px]" />
                <span className="font-medium text-ui-text-soft">Score by hand</span> in the match menu to assign points
                directly.
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
