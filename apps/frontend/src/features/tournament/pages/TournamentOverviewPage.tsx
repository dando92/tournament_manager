import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTableColumns } from "@fortawesome/free-solid-svg-icons";

/**
 * Deliberately empty, for now.
 *
 * Overview did two jobs and has lost both: its workspace totals moved to Stats,
 * and its grid of division cards was a second way to navigate the structure
 * that the tree now owns. What it becomes instead is still open.
 */
export default function TournamentOverviewPage() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <FontAwesomeIcon icon={faTableColumns} className="text-2xl text-ui-border-strong" />
      <p className="max-w-sm text-sm text-ui-text-mute">
        Pick a destination in the tree on the left. Totals moved to Stats; divisions, phases and pools live in the
        tree, and right-clicking any of them creates what goes inside it.
      </p>
    </div>
  );
}
