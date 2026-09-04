import type { AdvancementRuleDto, MatchSummaryDto, ScheduleDto } from "@tournament-manager/contracts";

import { buildScheduleTimeline, type ScheduleTimelineEntry, type ScheduleTimelineModel } from "@/features/schedule/model/scheduleTiming";
import { toOrdinal } from "@/shared/utils";

/**
 * The geometry of the schedule board.
 *
 * Every schedule it is given is a column on one shared time axis, so a block
 * that crosses the current time is late and says so by where it sits rather
 * than by carrying a badge. The model is pure: it takes the schedules and a
 * clock and answers with pixels, and the components draw what it says.
 *
 * The axis spans the blocks it was given and nothing else: the page decides
 * which schedules those are, one day at a time. See `scheduleDays.ts`.
 *
 * Time is placed by what actually happened wherever that is known — a settled
 * entry occupies its real start and completion, the current one grows until it
 * completes — and by the offset-adjusted estimate everywhere else. That is the
 * same timing model the Control Room reads, from `scheduleTiming.ts`.
 */

/** A block never gets shorter than a comfortable touch target. */
const MINIMUM_BLOCK_HEIGHT_PX = 44;

/** Below this a block drops its player list rather than compressing it. */
const COMPACT_BLOCK_HEIGHT_PX = 84;

/** Ticks, and the axis itself, land on half hours. */
const TICK_INTERVAL_MS = 30 * 60_000;

/** How much empty axis is kept after the last block, so "next" has somewhere to be. */
const TRAILING_MS = 15 * 60_000;

export type ScheduleBlockState = "completed" | "playing" | "waiting" | "upcoming";

export type ScheduleBoardBlock = {
    entry: ScheduleTimelineEntry;
    state: ScheduleBlockState;
    /** True while the entry is the schedule's cursor, whatever the schedule's own state. */
    current: boolean;
    startMs: number;
    endMs: number;
    top: number;
    height: number;
    /** Whether the block is tall enough to carry its player list. */
    compact: boolean;
};

export type ScheduleBoardColumn = {
    schedule: ScheduleDto;
    timeline: ScheduleTimelineModel;
    blocks: ScheduleBoardBlock[];
};

export type ScheduleBoardModel = {
    columns: ScheduleBoardColumn[];
    ticks: Array<{ atMs: number; top: number }>;
    /** Null when the present falls outside the day being read, which is every day but today. */
    nowTop: number | null;
    height: number;
};

export function buildScheduleBoard(schedules: ScheduleDto[], pixelsPerMinute: number, now = new Date()): ScheduleBoardModel {
    const nowMs = now.getTime();
    const columns = schedules.map((schedule) => toColumn(schedule, nowMs, now));
    const spans = columns.flatMap((column) => column.blocks.map((block) => [block.startMs, block.endMs] as const));
    const earliest = spans.length > 0 ? Math.min(...spans.map(([start]) => start)) : nowMs;
    const latest = spans.length > 0 ? Math.max(...spans.map(([, end]) => end)) : nowMs;
    const axisStart = floorToTick(earliest);
    const axisEnd = latest + TRAILING_MS;
    const perMs = pixelsPerMinute / 60_000;
    const height = Math.max(0, (axisEnd - axisStart) * perMs);

    for (const column of columns) {
        for (const block of column.blocks) {
            block.top = (block.startMs - axisStart) * perMs;
            block.height = Math.max(MINIMUM_BLOCK_HEIGHT_PX, (block.endMs - block.startMs) * perMs);
            block.compact = block.height < COMPACT_BLOCK_HEIGHT_PX;
        }
    }

    const ticks: ScheduleBoardModel["ticks"] = [];
    for (let atMs = ceilToTick(axisStart); atMs < axisEnd; atMs += TICK_INTERVAL_MS) {
        ticks.push({ atMs, top: (atMs - axisStart) * perMs });
    }

    const nowTop = nowMs >= axisStart && nowMs <= axisEnd ? (nowMs - axisStart) * perMs : null;

    return { columns, ticks, nowTop, height };
}

function toColumn(schedule: ScheduleDto, nowMs: number, now: Date): ScheduleBoardColumn {
    const timeline = buildScheduleTimeline(schedule, now);

    return {
        schedule,
        timeline,
        blocks: timeline.entries.map((entry) => {
            const current = entry.id === schedule.currentEntryId;
            const durationMs = entry.expectedDurationMinutes * 60_000;
            const startMs = new Date(entry.startedAt ?? entry.estimatedStartAt).getTime();
            const endMs = entry.completedAt
                ? new Date(entry.completedAt).getTime()
                : /* A match being played keeps growing past its expected end rather than
                     stopping at a time everyone can see it has passed. */
                  current && entry.startedAt
                    ? Math.max(startMs + durationMs, nowMs)
                    : startMs + durationMs;

            return { entry, state: stateOf(schedule, entry, current), current, startMs, endMs, top: 0, height: 0, compact: false };
        }),
    };
}

function stateOf(schedule: ScheduleDto, entry: ScheduleTimelineEntry, current: boolean): ScheduleBlockState {
    if (entry.match.state === "completed" || entry.completedAt) {
        return "completed";
    }
    if (!current) {
        return "upcoming";
    }
    if (schedule.staleCode) {
        return "waiting";
    }

    return entry.match.active ? "playing" : "upcoming";
}

function floorToTick(atMs: number): number {
    return Math.floor(atMs / TICK_INTERVAL_MS) * TICK_INTERVAL_MS;
}

function ceilToTick(atMs: number): number {
    return Math.ceil(atMs / TICK_INTERVAL_MS) * TICK_INTERVAL_MS;
}

/**
 * What a board card says about who is playing.
 *
 * A settled match collapses to its winner: the four names that got it there
 * stop being the useful fact the moment there is a result. A match still to be
 * played lists the players it holds, and then the slots it is still waiting
 * for, in the phrasing the bracket already uses — `1st from Pool C R4`.
 *
 * Which slots are still open is an approximation, and deliberately so: the DTO
 * says how many entrants a match holds and which rules feed it, but not which
 * rule produced which entrant. Filling the lowest slots first matches the
 * eligibility rule the API applies, and the API remains the authority on
 * whether the match can start. This is a preview, and it is allowed to be one.
 *
 * The winner arrives named. A summary carries the result as a player rather
 * than as points to be matched back against entrants it no longer holds.
 */
export type MatchLineupPreview = {
    winnerName: string | null;
    playerNames: string[];
    pendingSources: string[];
};

export function previewLineup(match: MatchSummaryDto): MatchLineupPreview {
    const playerNames = (match.entrants ?? []).flatMap((entrant) =>
        entrant.type === "player" ? [entrant.player?.playerName ?? entrant.name] : [entrant.name],
    );

    return {
        winnerName: match.winner?.playerName ?? null,
        playerNames,
        /* Already only the rules that feed this match, in slot order: the
           projection filters and sorts them, so nothing here does it again. */
        pendingSources: (match.incomingRules ?? []).slice(playerNames.length).map(sourceLabel),
    };
}

export function sourceLabel(rule: AdvancementRuleDto): string {
    return `${toOrdinal(rule.sourcePlacement)} from ${rule.sourceName ?? `${rule.sourceKind === "match" ? "Match" : "Pool"} ${rule.sourceId}`}`;
}
