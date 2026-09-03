import { previewLineup, type ScheduleBoardBlock } from "@/features/schedule/model/scheduleBoard";
import { formatClock } from "@/features/schedule/model/scheduleDateTime";
import StatusIcon from "@/shared/components/ui/StatusIcon";
import { focusRing } from "@/styles/buttonStyles";

/**
 * One match on the board.
 *
 * It carries the time, the name, one word of division and who is playing —
 * nothing else. Phase and pool were on it once and made every card three lines
 * taller for a fact almost nobody reads on a board; they moved to the detail.
 *
 * Two things keep it honest as it shrinks. A settled match collapses to its
 * winner rather than listing the four names that are no longer the point, and a
 * block too short for a lineup drops the lineup rather than compressing it —
 * the height comes from the match's expected duration, so a twenty-minute
 * showmatch cannot be made to hold what a forty-minute bracket match holds.
 */

const STATE_STYLE: Record<ScheduleBoardBlock["state"], string> = {
    completed: "border-ui-separator bg-ui-raised",
    playing: "border-state-live bg-ui-surface shadow-[0_0_0_3px_rgb(var(--state-live)/0.14)]",
    waiting: "border-state-pending bg-state-pending/10",
    upcoming: "border-ui-border bg-ui-surface",
};

/**
 * A collapsed column keeps its shape and loses its words.
 *
 * The bar is still the match's minutes at the board's scale, so a schedule that
 * is running late still visibly crosses the line at the present while somebody
 * reads another one. Nothing in it is readable, and nothing in it is a target:
 * the way back is its heading.
 */
const COLLAPSED_STATE_STYLE: Record<ScheduleBoardBlock["state"], string> = {
    completed: "bg-ui-raised",
    playing: "bg-state-live/70",
    waiting: "bg-state-pending/60",
    upcoming: "bg-ui-border",
};

export default function ScheduleBoardCard({
    block,
    divisionName,
    selected,
    collapsed = false,
    onOpen,
}: {
    block: ScheduleBoardBlock;
    divisionName: string | null;
    selected: boolean;
    collapsed?: boolean;
    onOpen: () => void;
}) {
    const { entry, state, compact } = block;
    const lineup = previewLineup(entry.match);

    if (collapsed) {
        return <span aria-hidden style={{ top: block.top, height: block.height }} className={`absolute inset-x-1 rounded ${COLLAPSED_STATE_STYLE[state]}`} />;
    }

    return (
        <button
            type="button"
            onClick={onOpen}
            style={{ top: block.top, height: block.height }}
            className={`absolute inset-x-0 overflow-hidden rounded-lg border px-2.5 py-2 text-left shadow-sm transition-colors hover:border-ui-border-strong ${focusRing} ${
                STATE_STYLE[state]
            } ${selected ? "ring-2 ring-ui-accent" : ""}`}
        >
            <span className="flex items-center gap-1.5">
                <BlockMarker state={state} />
                <span className="truncate text-[11px] font-semibold text-ui-text-mute">{timeLabel(block)}</span>
                {divisionName && <span className="ml-auto shrink-0 truncate text-[9px] font-bold uppercase tracking-wider text-ui-text-mute">{divisionName}</span>}
            </span>
            <span className={`mt-0.5 block truncate text-sm font-bold ${state === "completed" ? "text-ui-text-soft" : "text-ui-text"}`}>{entry.match.name}</span>
            {!compact && <Lineup lineup={lineup} state={state} />}
        </button>
    );
}

function Lineup({ lineup, state }: { lineup: ReturnType<typeof previewLineup>; state: ScheduleBoardBlock["state"] }) {
    if (state === "completed") {
        return <span className="mt-1 block truncate text-[11px] text-ui-text-mute">{lineup.winnerName ? `Won by ${lineup.winnerName}` : "Completed"}</span>;
    }

    return (
        <span className="mt-1 block text-[11px] leading-4">
            {lineup.playerNames.length > 0 && <span className="block truncate text-ui-text-soft">{lineup.playerNames.join(" · ")}</span>}
            {lineup.pendingSources.map((label) => (
                <span key={label} className="block truncate italic text-ui-text-mute">
                    {label}
                </span>
            ))}
            {lineup.playerNames.length === 0 && lineup.pendingSources.length === 0 && <span className="block text-ui-text-mute">No players yet</span>}
        </span>
    );
}

function BlockMarker({ state }: { state: ScheduleBoardBlock["state"] }) {
    if (state === "playing") {
        return (
            <>
                <span role="img" aria-label="Playing now" className="h-2 w-2 shrink-0 rounded-full bg-state-live" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-state-live">Now</span>
            </>
        );
    }
    if (state === "waiting") {
        return (
            <>
                <StatusIcon status="pending" className="h-3 w-3" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-state-pending">Waiting</span>
            </>
        );
    }

    return <StatusIcon status={state === "completed" ? "done" : "idle"} className="h-3 w-3" />;
}

function timeLabel(block: ScheduleBoardBlock): string {
    if (block.state === "completed") {
        return formatClock(block.startMs);
    }

    return `${formatClock(block.startMs)} – ${formatClock(block.endMs)}`;
}
