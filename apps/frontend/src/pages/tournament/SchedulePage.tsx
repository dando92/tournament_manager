import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useTournamentPageContext } from "@/features/tournament/model/TournamentPageContext";
import { groupSchedulesByDay, selectDay } from "@/features/schedule/model/scheduleDays";
import { useArchivedSchedules, useScheduleActivity, useSchedules } from "@/features/schedule/model/useSchedules";
import ScheduleBoard from "@/features/schedule/ui/ScheduleBoard";
import ScheduleMatchDetail from "@/features/schedule/ui/ScheduleMatchDetail";
import { btnSecondary } from "@/styles/buttonStyles";

/**
 * The tournament schedule: every schedule of one day of it, on one time axis.
 * Which day is a `?day=` search parameter.
 *
 * It reads the same projection the Control Room reads and exposes no operation,
 * which is what lets it be the page anybody opens. The match a reader has open
 * is a `?match=` search parameter rather than another route, the convention the
 * router already documents for a match opened over a list: the back button
 * closes the detail instead of leaving the page.
 */
export default function SchedulePage() {
    const { tournamentId, divisions } = useTournamentPageContext();
    const schedules = useSchedules(tournamentId);
    const [params, setParams] = useSearchParams();
    const [showArchived, setShowArchived] = useState(false);

    /* The live boards come from one request and the archived ones from another,
       fetched only while somebody is looking at them. How many there are is a
       count, so the button can offer them without them having been read. */
    const activity = useScheduleActivity(tournamentId);
    const archived = useArchivedSchedules(tournamentId, showArchived);
    const archivedCount = activity.data?.archivedCount ?? 0;
    const visible = showArchived ? [...schedules.schedules, ...(archived.data ?? [])] : schedules.schedules;
    const days = groupSchedulesByDay(visible);
    const selectedDay = selectDay(days, params.get("day"));
    const openedMatchId = Number(params.get("match")) || null;
    const openedSchedule = visible.find((schedule) => schedule.entries.some((entry) => entry.match.id === openedMatchId)) ?? null;

    function openMatch(matchId: number): void {
        setParams((current) => {
            const next = new URLSearchParams(current);
            next.set("match", String(matchId));
            return next;
        });
    }

    /* A day is a filter and not a destination, so it replaces rather than
       stacks, and it drops the match, which belongs to the day being left. */
    function openDay(dayKey: string): void {
        setParams(
            (current) => {
                const next = new URLSearchParams(current);
                next.set("day", dayKey);
                next.delete("match");
                return next;
            },
            { replace: true },
        );
    }

    function closeMatch(): void {
        setParams(
            (current) => {
                const next = new URLSearchParams(current);
                next.delete("match");
                return next;
            },
            { replace: true },
        );
    }

    if (schedules.query.isLoading) {
        return <p className="py-12 text-center text-sm text-ui-text-mute">Loading the schedule…</p>;
    }
    if (schedules.query.isError) {
        return <p className="py-12 text-center text-sm text-state-failed">Unable to load the schedule.</p>;
    }

    return (
        <div className="flex min-w-0 flex-col gap-3">
            {archivedCount > 0 && (
                <div className="flex justify-end">
                    <button type="button" className={btnSecondary} onClick={() => setShowArchived((value) => !value)}>
                        {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
                    </button>
                </div>
            )}

            <ScheduleBoard
                schedules={selectedDay?.schedules ?? visible}
                divisions={divisions}
                days={days}
                selectedDay={selectedDay}
                onSelectDay={openDay}
                selectedMatchId={openedMatchId}
                onOpenMatch={openMatch}
            />

            <ScheduleMatchDetail schedule={openedSchedule} matchId={openedMatchId} divisions={divisions} onClose={closeMatch} />
        </div>
    );
}
