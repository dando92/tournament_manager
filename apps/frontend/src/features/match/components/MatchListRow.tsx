import StatusIcon, { StatusBadge } from "@/shared/components/ui/StatusIcon";
import {
  getActiveLabel,
  getCommitBadgeLabel,
  getCommitStatus,
  getMatchCommitState,
} from "@/features/match/utils/matchStatus";
import { entrantPlayers } from "@/features/entrant/types/Entrant";
import { Match } from "@/features/match/types/Match";

/**
 * One match in the list.
 *
 * Two independent things are worth knowing at a glance and they get fixed
 * positions rather than sharing one mark: whether the match is *active* sits
 * on the left, how close its result is to being final sits on the right. A
 * match can be running and not yet committable, so folding them into a single
 * status would lose the case that matters most during a tournament.
 */

type MatchListRowProps = {
  match: Match;
  selected: boolean;
  /** Lit because an advancement route in the open card points at this match. */
  routed: boolean;
  onSelect: () => void;
};

export default function MatchListRow({ match, selected, routed, onSelect }: MatchListRowProps) {
  const commitState = getMatchCommitState(match);
  const playerCount = entrantPlayers(match.entrants).length;
  const players = `${playerCount} player${playerCount !== 1 ? "s" : ""}`;
  const meta =
    match.rounds.length > 0
      ? `${players} · ${match.rounds.length} song${match.rounds.length !== 1 ? "s" : ""}`
      : playerCount > 0
        ? players
        : "not started";

  return (
    <button
      type="button"
      onClick={onSelect}
      title={getActiveLabel(match.active)}
      className={`flex w-full items-center gap-3 border-b border-ui-border px-3 py-2.5 text-left transition-colors last:border-b-0 ${
        routed
          ? "bg-state-done/10 shadow-[inset_2px_0_0_rgb(var(--state-done))]"
          : selected
            ? "bg-ui-selected shadow-[inset_2px_0_0_rgb(var(--ui-border-strong))]"
            : "bg-ui-surface hover:bg-ui-raised"
      }`}
    >
      <StatusIcon status={match.active ? "running" : "idle"} label={getActiveLabel(match.active)} />

      <span className={`shrink-0 text-sm text-ui-text ${selected ? "font-bold" : "font-semibold"}`}>{match.name}</span>

      <span className="min-w-0 flex-1 truncate text-[13px] text-ui-text-mute">
        {match.subtitle ? `${match.subtitle} · ${meta}` : meta}
      </span>

      <span className="hidden shrink-0 sm:block">
        <StatusBadge status={getCommitStatus(commitState)} label={getCommitBadgeLabel(commitState)} />
      </span>
      <span className="shrink-0 sm:hidden">
        <StatusIcon status={getCommitStatus(commitState)} label={getCommitBadgeLabel(commitState)} />
      </span>
    </button>
  );
}
