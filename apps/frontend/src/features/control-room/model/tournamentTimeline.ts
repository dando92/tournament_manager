import type { ControlRoomFlowDto } from "@tournament-manager/contracts";

const ON_TIME_THRESHOLD_MS = 5 * 60_000;

export type TournamentTimelineEntry = ControlRoomFlowDto["entries"][number] & {
    plannedStartAt: string;
    estimatedStartAt: string;
    displayedStartAt: string;
};

export type TournamentTimelineModel = {
    entries: TournamentTimelineEntry[];
    offsetMs: number;
    roundedOffsetMinutes: number;
    timingStatus: "on-time" | "delayed" | "ahead";
};

export function buildTournamentTimeline(flow: ControlRoomFlowDto, now = new Date()): TournamentTimelineModel {
    let plannedCursor = new Date(flow.willStartAt).getTime();
    const plannedStarts = flow.entries.map((entry) => {
        const start = plannedCursor;
        plannedCursor += entry.expectedDurationMinutes * 60_000;
        return start;
    });
    const currentIndex = flow.entries.findIndex((entry) => entry.id === flow.currentEntryId);
    const latestCompletedIndex = findLatestCompletedIndex(flow);
    let offsetMs = 0;

    const currentEntry = currentIndex >= 0 ? flow.entries[currentIndex] : null;
    if (currentEntry?.startedAt) {
        offsetMs = new Date(currentEntry.startedAt).getTime() - plannedStarts[currentIndex];
    } else if (latestCompletedIndex >= 0) {
        const entry = flow.entries[latestCompletedIndex];
        if (entry.completedAt) {
            const plannedCompletion = plannedStarts[latestCompletedIndex] + entry.expectedDurationMinutes * 60_000;
            offsetMs = new Date(entry.completedAt).getTime() - plannedCompletion;
        }
    } else if ((flow.status === "running" || flow.status === "paused") && currentIndex >= 0) {
        offsetMs = Math.max(0, now.getTime() - plannedStarts[currentIndex]);
    }

    const estimateFromIndex = currentIndex >= 0 ? currentIndex : latestCompletedIndex + 1;
    const entries = flow.entries.map((entry, index) => {
        const plannedStartAt = new Date(plannedStarts[index]).toISOString();
        const estimatedStartAt = new Date(plannedStarts[index] + (index >= estimateFromIndex ? offsetMs : 0)).toISOString();
        return {
            ...entry,
            plannedStartAt,
            estimatedStartAt,
            displayedStartAt: entry.startedAt ?? estimatedStartAt,
        };
    });
    const timingStatus = Math.abs(offsetMs) < ON_TIME_THRESHOLD_MS ? "on-time" : offsetMs > 0 ? "delayed" : "ahead";
    const roundedOffsetMinutes = timingStatus === "on-time" ? 0 : Math.max(10, Math.round(Math.abs(offsetMs) / 600_000) * 10);

    return { entries, offsetMs, roundedOffsetMinutes, timingStatus };
}

function findLatestCompletedIndex(flow: ControlRoomFlowDto): number {
    for (let index = flow.entries.length - 1; index >= 0; index -= 1) {
        if (flow.entries[index].completedAt) return index;
    }
    return -1;
}

export function timingStatusLabel(model: TournamentTimelineModel): string {
    if (model.timingStatus === "on-time") return "ON TIME";
    if (model.timingStatus === "delayed") return `+${model.roundedOffsetMinutes} MIN DELAY`;
    return `${model.roundedOffsetMinutes} MIN AHEAD`;
}
