import type { ScheduleSummary } from "@/features/schedule/model/scheduleSummary";
import StatusIcon from "@/shared/components/ui/StatusIcon";
import { focusRing } from "@/styles/buttonStyles";

/**
 * The one control that says which schedules a tournament is running.
 *
 * Both pages mount it: the board uses the cards as its column headings, at
 * every width, and the Control Room as a tab row. It replaces the anonymous dot
 * rail the Control Room used to carry and the vertical rail the overview drew on
 * the sidebar surface — neither of which named a schedule, so neither could tell
 * an operator that a second cabinet was stuck.
 *
 * A phone gets the same headings rather than a chip rail of its own: two
 * controls naming the same schedules, one above the other, is the crowding this
 * component exists to remove.
 *
 * Selection is the accent bar and nothing else, as everywhere else in the
 * interface, and the state colour stays inside the glyph and the badge shell.
 */

const TIMING_TONE: Record<"on-time" | "delayed" | "ahead", string> = {
    "on-time": "border-state-done/40 bg-state-done/10",
    delayed: "border-state-failed/40 bg-state-failed/10",
    ahead: "border-state-done/40 bg-state-done/10",
};

export function ScheduleSwitcherCard({
    summary,
    selected,
    onSelect,
    collapsed = false,
    className = "",
}: {
    summary: ScheduleSummary;
    selected: boolean;
    onSelect: () => void;
    /** The heading of a column that gave its room to another one. */
    collapsed?: boolean;
    className?: string;
}) {
    const badge = summary.timing?.label ?? summary.stateLabel.toUpperCase();
    const tone = summary.timing ? TIMING_TONE[summary.timing.tone] : "border-ui-border-strong bg-ui-raised";
    /* Below the small breakpoint a column is 152px wide, and a name sharing that
       line with the badge is three letters and an ellipsis. The badge drops to
       the line under it, where there is nothing it can crowd. */
    const badgeClass = `shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider text-ui-text-soft ${tone}`;

    /* Collapsed, it keeps exactly what identifies the column — its state and its
       name, turned on its side — and gives up everything that needs width. It
       stays a full-height target, so getting back to it is one tap. */
    if (collapsed) {
        return (
            <button
                type="button"
                title={summary.schedule.name}
                onClick={onSelect}
                className={`flex flex-col items-center gap-2 rounded-xl border border-ui-border bg-ui-surface py-2 text-ui-text-mute transition-colors hover:bg-ui-raised hover:text-ui-text ${focusRing} ${className}`}
            >
                <ScheduleGlyph summary={summary} />
                <span className="max-h-40 overflow-hidden text-xs font-semibold [writing-mode:vertical-rl]">{summary.schedule.name}</span>
            </button>
        );
    }

    return (
        <button
            type="button"
            aria-current={selected ? "true" : undefined}
            onClick={onSelect}
            className={`flex min-w-0 flex-col gap-1 rounded-xl border px-3 py-2 text-left transition-colors ${focusRing} ${
                selected ? "border-ui-border-strong bg-ui-selected shadow-[inset_0_-3px_0_0_rgb(var(--ui-accent))]" : "border-ui-border bg-ui-surface hover:bg-ui-raised"
            } ${summary.schedule.archivedAt ? "opacity-70" : ""} ${className}`}
        >
            <span className="flex min-w-0 items-center gap-2">
                <ScheduleGlyph summary={summary} />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-ui-text">{summary.schedule.name}</span>
                <span className={`hidden sm:inline-block ${badgeClass}`}>{badge}</span>
            </span>
            <span className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs text-ui-text-mute">
                    {summary.stateLabel} · {summary.detail}
                </span>
                <span className={`sm:hidden ${badgeClass}`}>{badge}</span>
            </span>
        </button>
    );
}

/**
 * The live dot is not a status ring.
 *
 * `running` says a schedule is armed; a violet dot says a match is being played
 * on it this second, which is the one thing an operator scanning four columns
 * is looking for. The ring covers every other state.
 */
export function ScheduleGlyph({ summary, className = "" }: { summary: ScheduleSummary; className?: string }) {
    if (summary.live) {
        return (
            <span
                aria-label="Playing now"
                role="img"
                className={`h-2.5 w-2.5 shrink-0 rounded-full bg-state-live shadow-[0_0_0_4px_rgb(var(--state-live)/0.18)] ${className}`}
            />
        );
    }

    return <StatusIcon status={summary.status} label={summary.stateLabel} className={className} />;
}

export default function ScheduleSwitcher({
    summaries,
    selectedId,
    onSelect,
}: {
    summaries: ScheduleSummary[];
    selectedId: number | null;
    onSelect: (scheduleId: number) => void;
}) {
    return (
        <div role="tablist" aria-label="Schedules" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {summaries.map((summary) => (
                <ScheduleSwitcherCard
                    key={summary.schedule.id}
                    summary={summary}
                    selected={summary.schedule.id === selectedId}
                    onSelect={() => onSelect(summary.schedule.id)}
                    className="w-56 shrink-0"
                />
            ))}
        </div>
    );
}
