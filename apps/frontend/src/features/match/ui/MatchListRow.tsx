import { type CSSProperties, useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/shared/components/ui/StatusIcon";
import { ActiveIndicator } from "@/shared/components/ui/StatusDot";
import {
  getActiveLabel,
  getCommitBlocker,
  getMatchProgress,
  getMatchProgressLabel,
  getMatchProgressStatus,
} from "@/features/match/model/matchStatus";
import { entrantPlayers } from "@/features/participant/model/entrant";
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
  onTiebreak: () => void;
};

export default function MatchListRow({
  match,
  selected,
  routed,
  controls,
  onSelect,
  onCommit,
  onTiebreak,
}: MatchListRowProps) {
  const nameViewportRef = useRef<HTMLSpanElement>(null);
  const nameContentRef = useRef<HTMLSpanElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const [marqueeLayout, setMarqueeLayout] = useState({ distance: 0, fadeWidth: 0 });
  const [mobileMarquee, setMobileMarquee] = useState(false);
  const progress = getMatchProgress(match);
  const status = getMatchProgressStatus(progress);
  const blocker = getCommitBlocker(match);
  const label = blocker ?? getMatchProgressLabel(progress);
  const canCommit = controls && progress === "readyToCommit";
  const needsTiebreak = controls && progress === "tiebreakRequired";

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

  useEffect(() => {
    const viewport = nameViewportRef.current;
    const content = nameContentRef.current;
    const statusOverlay = statusRef.current;
    if (!viewport || !content || !statusOverlay) return;

    const measure = () => {
      const fadeWidth = Math.min(viewport.clientWidth, statusOverlay.offsetWidth + 16);
      setMarqueeLayout({
        distance: Math.max(0, content.scrollWidth - (viewport.clientWidth - fadeWidth)),
        fadeWidth,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    observer.observe(statusOverlay);
    return () => observer.disconnect();
  }, [match.name, match.subtitle, meta]);

  const marqueeStyle = {
    "--marquee-distance": `${marqueeLayout.distance}px`,
    WebkitMaskImage: `linear-gradient(to right, black 0, black calc(100% - ${marqueeLayout.fadeWidth}px), transparent 100%)`,
    maskImage: `linear-gradient(to right, black 0, black calc(100% - ${marqueeLayout.fadeWidth}px), transparent 100%)`,
  } as CSSProperties;
  const canMarquee = marqueeLayout.distance > 0;

  return (
    <div
      className={`relative flex w-full items-center overflow-hidden border-b border-ui-separator bg-ui-row transition-colors last:border-b-0 ${
        routed
          ? "bg-ui-selected shadow-[inset_3px_0_0_rgb(var(--ui-accent))]"
          : selected
            ? "bg-ui-selected shadow-[inset_3px_0_0_rgb(var(--ui-accent))]"
            : "hover:bg-ui-raised/50"
      }`}
    >
      <button
        type="button"
        onClick={() => {
          if (canMarquee && window.matchMedia("(hover: none)").matches) {
            setMobileMarquee((current) => !current);
          }
          onSelect();
        }}
        title={getActiveLabel(match.active)}
        className="group/name flex min-w-0 flex-1 items-center gap-3 overflow-hidden px-3 py-2.5 text-left"
      >
        <ActiveIndicator on={match.active} label={getActiveLabel(match.active)} />

        <span
          ref={nameViewportRef}
          style={marqueeStyle}
          className="min-w-0 flex-1 overflow-hidden"
        >
          <span
            ref={nameContentRef}
            className={`inline-flex w-max items-center gap-3 whitespace-nowrap ${
              canMarquee && mobileMarquee ? "motion-safe:animate-marquee" : ""
            } ${canMarquee ? "motion-safe:group-hover/name:animate-marquee" : ""}`}
          >
            <span className={`text-sm text-ui-text ${selected ? "font-bold" : "font-semibold"}`}>
              {match.name}
            </span>
            <span className="text-[13px] text-ui-text-mute">
              {match.subtitle ? `${match.subtitle} · ${meta}` : meta}
            </span>
          </span>
        </span>
      </button>

      <div ref={statusRef} className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pr-3">
        {canCommit || needsTiebreak ? (
          <button
            type="button"
            onClick={needsTiebreak ? onTiebreak : onCommit}
            className="pointer-events-auto rounded-md border border-state-pending/30 bg-state-pending/10 px-3 py-1 text-xs font-semibold text-ui-text-soft transition-colors hover:bg-state-pending/20"
          >
            {needsTiebreak ? "Tiebreak" : "Commit"}
          </button>
        ) : (
          <StatusBadge status={status} label={label} />
        )}
      </div>
    </div>
  );
}
