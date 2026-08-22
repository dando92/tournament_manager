import StatusIcon, { StatusBadge } from "@/shared/components/ui/StatusIcon";
import {
  getActiveLabel,
  getCommitBlocker,
  getMatchProgress,
  getMatchProgressLabel,
  getMatchProgressStatus,
} from "@/features/match/model/matchStatus";
import { entrantPlayers } from "@/features/entrant/types/Entrant";
import { Match } from "@/features/match/model/types";

/**
 * One match in the list.
 *
 * The row carries everything about the *state* of a match; the card below
 * carries its contents. That split is why the commit button lives here —
 * whether a match can be closed is a fact about it, readable while scanning —
 * and it leaves the card free to be about players and songs.
 *
 * Two independent facts sit in fixed positions rather than sharing one mark:
 * whether the match is *active* on the left, how close its result is to final
 * on the right. A match can be running and nowhere near committable, and
 * folding those together would lose the case that matters most mid-tournament.
 *
 * The row is a div holding a button rather than one big button: a commit button
 * nested inside a select button is neither valid HTML nor reachable by
 * keyboard.
 */

type MatchListRowProps = {
  match: Match;
  selected: boolean;
  /** Lit because an advancement route in the open card points at this match. */
  routed: boolean;
  controls: boolean;
  onSelect: () => void;
  onCommit: () => void;
};

export default function MatchListRow({
  match,
  selected,
  routed,
  controls,
  onSelect,
  onCommit,
}: MatchListRowProps) {
  const progress = getMatchProgress(match);
  const status = getMatchProgressStatus(progress);
  const blocker = getCommitBlocker(match);
  const label = blocker ?? getMatchProgressLabel(progress);
  const canCommit = controls && progress === "readyToCommit";

  const playerCount = entrantPlayers(match.entrants).length;
  const players = `${playerCount} player${playerCount !== 1 ? "s" : ""}`;
  /* Counting rounds would call the hand-scored one a song, which is the one
     thing it is not. */
  const songCount = match.rounds.filter((round) => round.song !== null).length;
  const handScored = match.rounds.some((round) => round.song === null);
  const meta = handScored
    ? `${players} · by hand`
    : songCount > 0
      ? `${players} · ${songCount} song${songCount !== 1 ? "s" : ""}`
      : playerCount > 0
        ? players
        : "not started";

  return (
    <div
      className={`flex w-full items-center border-b border-ui-border transition-colors last:border-b-0 ${
        routed
          ? "bg-state-done/10 shadow-[inset_2px_0_0_rgb(var(--state-done))]"
          : selected
            ? "bg-ui-selected shadow-[inset_2px_0_0_rgb(var(--ui-border-strong))]"
            : "bg-ui-surface hover:bg-ui-raised"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        title={getActiveLabel(match.active)}
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
      >
        <StatusIcon status={match.active ? "running" : "idle"} label={getActiveLabel(match.active)} />

        <span className={`shrink-0 text-sm text-ui-text ${selected ? "font-bold" : "font-semibold"}`}>
          {match.name}
        </span>

        <span className="min-w-0 flex-1 truncate text-[13px] text-ui-text-mute">
          {match.subtitle ? `${match.subtitle} · ${meta}` : meta}
        </span>
      </button>

      <div className="flex shrink-0 items-center pr-3">
        {canCommit ? (
          <button
            type="button"
            onClick={onCommit}
            className="rounded-md border border-state-pending/30 bg-state-pending/10 px-3 py-1 text-xs font-semibold text-ui-text-soft transition-colors hover:bg-state-pending/20"
          >
            Commit
          </button>
        ) : (
          <>
            <span className="hidden sm:block">
              <StatusBadge status={status} label={label} />
            </span>
            <span className="sm:hidden">
              <StatusIcon status={status} label={label} />
            </span>
          </>
        )}
      </div>
    </div>
  );
}
