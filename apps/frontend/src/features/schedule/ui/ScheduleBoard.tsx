import { useEffect, useMemo, useRef, useState } from "react";
import type { ScheduleDto } from "@tournament-manager/contracts";

import { buildScheduleBoard } from "@/features/schedule/model/scheduleBoard";
import { divisionNameOf } from "@/features/schedule/model/scheduleContext";
import { formatClock } from "@/features/schedule/model/scheduleDateTime";
import { summarizeSchedule } from "@/features/schedule/model/scheduleSummary";
import ScheduleBoardCard from "@/features/schedule/ui/ScheduleBoardCard";
import { ScheduleSwitcherCard } from "@/features/schedule/ui/ScheduleSwitcher";
import type { TournamentDivisionOption } from "@/features/tournament/model/types";

/**
 * Every schedule of the tournament, on one time axis.
 *
 * The point of the board is the comparison: four columns, one clock, and a
 * dashed line at the present, so "Cabinet B is twenty minutes behind" is read
 * off the geometry instead of off a badge. The phone keeps the same board with
 * narrower columns rather than falling back to a list of one schedule at a
 * time — two and a half columns fit, which is what tells a reader there are
 * more of them.
 *
 * It reads and never operates. Selecting a card opens the match read-only;
 * Control Room is where a schedule is started, paused or reordered.
 */

const DESKTOP_PIXELS_PER_MINUTE = 3.4;
const PHONE_PIXELS_PER_MINUTE = 3;
const REFRESH_INTERVAL_MS = 60_000;

const GUTTER_CLASS = "w-11 shrink-0 sm:w-14";

/**
 * How wide a column is, which is what choosing one does.
 *
 * With nothing chosen every schedule gets the same room, and the phone scrolls
 * through them. Choosing one gives it everything that is left and folds the
 * others into a strip: their blocks keep their heights, so a schedule running
 * late still visibly crosses the line at the present, but nothing in them
 * competes for reading. Choosing it again unfolds them.
 *
 * The same on a phone, where it matters more — one schedule at full width
 * beside two folded strips is the only way a 390px screen shows a match name,
 * its players and the clock at once.
 *
 * Header and body take the same class, so a column and its heading cannot
 * drift apart.
 */
const COLLAPSED_COLUMN_CLASS = "w-11 shrink-0";

function columnClass(focused: boolean, anyFocused: boolean): string {
    if (!anyFocused) {
        return "w-[152px] shrink-0 sm:w-auto sm:min-w-[12rem] sm:flex-1";
    }

    return focused ? "min-w-0 flex-1" : COLLAPSED_COLUMN_CLASS;
}

export default function ScheduleBoard({
    schedules,
    divisions,
    selectedMatchId,
    onOpenMatch,
}: {
    schedules: ScheduleDto[];
    divisions: TournamentDivisionOption[];
    selectedMatchId: number | null;
    onOpenMatch: (matchId: number) => void;
}) {
    const [now, setNow] = useState(() => new Date());
    const [focusedScheduleId, setFocusedScheduleId] = useState<number | null>(null);
    const compact = useCompactViewport();
    const columnRefs = useRef(new Map<number, HTMLDivElement>());

    useEffect(() => {
        const interval = window.setInterval(() => setNow(new Date()), REFRESH_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, []);

    const board = useMemo(
        () => buildScheduleBoard(schedules, compact ? PHONE_PIXELS_PER_MINUTE : DESKTOP_PIXELS_PER_MINUTE, now),
        [schedules, compact, now],
    );
    const summaries = useMemo(() => schedules.map((schedule) => summarizeSchedule(schedule, now)), [schedules, now]);
    /* A schedule that has gone from the board takes its focus with it, or the
       remaining columns stay narrow for a column nobody can see. */
    const focused = schedules.some((schedule) => schedule.id === focusedScheduleId) ? focusedScheduleId : null;

    /* The column headings are the switcher. Choosing one expands it and folds
       the rest away; choosing it again gives every schedule the same room back.
       A separate chip rail above them said the same names twice, and went. */
    function toggleFocus(scheduleId: number) {
        if (scheduleId === focused) {
            setFocusedScheduleId(null);
            return;
        }
        setFocusedScheduleId(scheduleId);
        columnRefs.current.get(scheduleId)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    }

    if (schedules.length === 0) {
        return <p className="rounded-xl border border-dashed border-ui-border-strong py-16 text-center text-sm text-ui-text-mute">No schedule has been created yet.</p>;
    }

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <div className="min-w-0 overflow-x-auto pb-2">
                <div className={`flex flex-col ${focused === null ? "min-w-max sm:min-w-0" : "min-w-0"}`}>
                    <div className="sticky top-0 z-20 flex gap-2 bg-ui-canvas pb-3 sm:gap-3">
                        <div className={GUTTER_CLASS} />
                        {board.columns.map((column, index) => (
                            <ScheduleSwitcherCard
                                key={column.schedule.id}
                                summary={summaries[index]}
                                selected={column.schedule.id === focused}
                                collapsed={focused !== null && column.schedule.id !== focused}
                                onSelect={() => toggleFocus(column.schedule.id)}
                                className={columnClass(column.schedule.id === focused, focused !== null)}
                            />
                        ))}
                    </div>

                    <div className="relative flex gap-2 sm:gap-3" style={{ height: board.height }}>
                        <div className={`relative ${GUTTER_CLASS}`}>
                            {board.ticks.map((tick) => (
                                <span key={tick.atMs} style={{ top: tick.top }} className="absolute right-0 -translate-y-1/2 text-[11px] font-semibold text-ui-text-mute">
                                    {formatClock(tick.atMs)}
                                </span>
                            ))}
                            {board.nowTop !== null && (
                                <span
                                    style={{ top: board.nowTop }}
                                    className="absolute right-0 z-10 -translate-y-1/2 rounded-full bg-state-live px-1.5 py-0.5 text-[10px] font-bold text-ui-surface"
                                >
                                    {formatClock(now.getTime())}
                                </span>
                            )}
                        </div>

                        {board.columns.map((column) => {
                            const collapsed = focused !== null && column.schedule.id !== focused;

                            return (
                                <div
                                    key={column.schedule.id}
                                    ref={(element) => {
                                        if (element) columnRefs.current.set(column.schedule.id, element);
                                        else columnRefs.current.delete(column.schedule.id);
                                    }}
                                    className={`relative border-l border-ui-separator ${columnClass(column.schedule.id === focused, focused !== null)} ${
                                        column.schedule.archivedAt ? "opacity-70" : ""
                                    }`}
                                >
                                    {column.blocks.length === 0 && !collapsed && (
                                        <p className="absolute inset-x-0 top-0 rounded-lg border border-dashed border-ui-border-strong py-8 text-center text-xs text-ui-text-mute">
                                            No matches
                                        </p>
                                    )}
                                    {column.blocks.map((block) => (
                                        <ScheduleBoardCard
                                            key={block.entry.id}
                                            block={block}
                                            divisionName={divisionNameOf(divisions, block.entry.match.phaseGroupId)}
                                            selected={block.entry.match.id === selectedMatchId}
                                            collapsed={collapsed}
                                            onOpen={() => onOpenMatch(block.entry.match.id)}
                                        />
                                    ))}
                                </div>
                            );
                        })}

                        {board.nowTop !== null && (
                            <span aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-state-live" style={{ top: board.nowTop }} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Whether the board is being read on a phone.
 *
 * The scale is a model input rather than a class, because the height of a block
 * is minutes and not a breakpoint, so the component has to know the number.
 */
function useCompactViewport(): boolean {
    const [compact, setCompact] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches);

    useEffect(() => {
        const query = window.matchMedia("(max-width: 639px)");
        const update = (event: MediaQueryListEvent) => setCompact(event.matches);
        query.addEventListener("change", update);
        setCompact(query.matches);
        return () => query.removeEventListener("change", update);
    }, []);

    return compact;
}
