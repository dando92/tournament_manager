import type { ScheduleDto } from "@tournament-manager/contracts";

import { formatDayLabel } from "@/features/schedule/model/scheduleDateTime";

/**
 * A day is the local day a schedule starts on, and every match it runs belongs
 * to that day however far past midnight it goes. A schedule plans as one
 * cumulative sum from `willStartAt` and has no notion of a break, so a day
 * cannot be a property of the match.
 */

export type ScheduleDay = {
    /** The local calendar day, `YYYY-MM-DD`, which is what the URL carries. */
    key: string;
    label: string;
    schedules: ScheduleDto[];
};

export function dayKeyOf(value: string | number | Date): string {
    const date = new Date(value);
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");

    return `${date.getFullYear()}-${month}-${day}`;
}

export function groupSchedulesByDay(schedules: ScheduleDto[]): ScheduleDay[] {
    const days = new Map<string, ScheduleDay>();

    for (const schedule of schedules) {
        const key = dayKeyOf(schedule.willStartAt);
        const day = days.get(key) ?? { key, label: formatDayLabel(schedule.willStartAt), schedules: [] };
        day.schedules.push(schedule);
        days.set(key, day);
    }

    return [...days.values()].sort((left, right) => left.key.localeCompare(right.key));
}

/** Falls back to today, then to the next day that has anything, so a tournament that has not started opens on its first day and a finished one on its last. */
export function selectDay(days: ScheduleDay[], requestedKey: string | null, now = new Date()): ScheduleDay | null {
    if (days.length === 0) {
        return null;
    }

    const requested = days.find((day) => day.key === requestedKey);
    if (requested) {
        return requested;
    }

    const todayKey = dayKeyOf(now);

    return days.find((day) => day.key >= todayKey) ?? days[days.length - 1];
}
