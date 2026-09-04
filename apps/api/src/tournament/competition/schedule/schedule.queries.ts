import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Not, Repository } from "typeorm";
import type {
    MatchSummaryDto,
    ScheduleActivityDto,
    ScheduleCreationDto,
    ScheduleDto,
    ScheduleEditorDto,
    ScheduleStaleCode,
} from "@tournament-manager/contracts";
import { Schedule } from "@tournament-manager/persistence";

import { MatchQueries } from "@match/match.queries";

/** The rows `UNASSIGNED_MATCH_IDS_OF_TOURNAMENT` produces. */
type UnassignedMatchRow = { matchId: number };

/**
 * Every match of the tournament that no schedule of it holds yet, which is what
 * both the creation form and the editor offer.
 *
 * The subtraction is a `NOT EXISTS` rather than a projection of every match of
 * the tournament filtered in memory: only the matches actually offered are
 * projected afterwards, through `MatchQueries.summariesByIds`.
 */
const UNASSIGNED_MATCH_IDS_OF_TOURNAMENT = `
    SELECT   m."id" AS "matchId"
    FROM     "match" m
    JOIN     "phase_group" pg ON pg."id" = m."phaseGroupId"
    JOIN     "phase" ph ON ph."id" = pg."phaseId"
    JOIN     "division" d ON d."id" = ph."divisionId"
    WHERE    d."tournamentId" = $1
        AND  NOT EXISTS (
                SELECT  1
                FROM    "schedule_entry" entry
                JOIN    "schedule" s ON s."id" = entry."scheduleId"
                WHERE   entry."matchId" = m."id" AND s."tournamentId" = $1
             )
    ORDER BY m."id"
`;

/**
 * What the tournament's schedules amount to, in one row.
 *
 * Two counts over `schedule` alone. Both used to be answered by reading every
 * board of the tournament with its entries: one to decide whether a match card
 * may be activated by hand, the other to label a button that offers the
 * archived boards.
 */
const SCHEDULE_ACTIVITY_OF_TOURNAMENT = `
    SELECT  count(*) FILTER (WHERE s."status" = 'running')              AS "runningCount",
            count(*) FILTER (WHERE s."archivedAt" IS NOT NULL)          AS "archivedCount"
    FROM    "schedule" s
    WHERE   s."tournamentId" = $1
`;

/** Which tournament a schedule belongs to. */
const TOURNAMENT_ID_OF_SCHEDULE = `
    SELECT  s."tournamentId" AS "tournamentId"
    FROM    "schedule" s
    WHERE   s."id" = $1
`;

@Injectable()
export class ScheduleQueries {
    constructor(
        @InjectRepository(Schedule) private readonly schedules: Repository<Schedule>,
        private readonly matches: MatchQueries,
    ) {}

    /**
     * Every schedule of a tournament, with the matches its entries hold.
     *
     * The entries are read first and the projection is then asked for exactly
     * their matches. Reading the schedules and every match of the tournament in
     * parallel saved a round trip and projected every unassigned match — rounds,
     * standings, tiebreaks and the scores behind them — only to discard it. That
     * was affordable while the Control Room was the only reader; the schedule
     * board makes this the read of every viewer of a tournament, so the trade
     * turns around. See item 31 in `QueryAndSchemaOptimization.md`.
     *
     * The archived boards are excluded here rather than in the browser. They are
     * a separate ask because they are a separate question — what was, not what
     * is — and on a tournament whose boards are a quarter archived they were a
     * quarter of a payload both pages then filtered away.
     */
    async forTournament(tournamentId: number, archived = false): Promise<ScheduleDto[]> {
        const schedules = await this.schedules.find({
            where: { tournament: { id: tournamentId }, archivedAt: archived ? Not(IsNull()) : IsNull() },
            relations: { entries: { match: true } },
            order: { id: "ASC", entries: { position: "ASC" } },
        });
        const matches = await this.matches.summariesByIds([...new Set(schedules.flatMap((schedule) => this.matchIdsOf(schedule)))]);
        const matchById = new Map(matches.map((match) => [match.id, match]));

        return schedules.map((schedule) => this.toDto(schedule, matchById));
    }

    /** Two counts over the schedules themselves, for the callers that need no board. */
    async activity(tournamentId: number): Promise<ScheduleActivityDto> {
        const rows: Array<{ runningCount: string; archivedCount: string }> = await this.schedules.manager.query(
            SCHEDULE_ACTIVITY_OF_TOURNAMENT,
            [tournamentId],
        );

        return { running: Number(rows[0]?.runningCount ?? 0) > 0, archivedCount: Number(rows[0]?.archivedCount ?? 0) };
    }

    async byId(scheduleId: number): Promise<ScheduleDto> {
        const schedule = await this.scheduleOrFail(scheduleId);
        const matches = await this.matches.summariesByIds(this.matchIdsOf(schedule));

        return this.toDto(schedule, new Map(matches.map((match) => [match.id, match])));
    }

    async creation(tournamentId: number): Promise<ScheduleCreationDto> {
        const unassignedIds = await this.unassignedMatchIdsOf(tournamentId);

        return { unassignedMatches: await this.matches.summariesByIds(unassignedIds) };
    }

    async editor(scheduleId: number): Promise<ScheduleEditorDto> {
        const schedule = await this.scheduleOrFail(scheduleId);
        if (schedule.status !== "inactive" || schedule.archivedAt) {
            throw new ConflictException(`Schedule ${scheduleId} is not editable`);
        }
        const tournamentId = await this.tournamentIdOf(scheduleId);
        const unassignedIds = await this.unassignedMatchIdsOf(tournamentId);
        const scheduleMatchIds = this.matchIdsOf(schedule);
        const matches = await this.matches.summariesByIds([...new Set([...scheduleMatchIds, ...unassignedIds])]);
        const matchById = new Map(matches.map((match) => [match.id, match]));
        const unassigned = new Set(unassignedIds);

        return {
            schedule: this.toDto(schedule, matchById),
            unassignedMatches: matches.filter((match) => unassigned.has(match.id)),
        };
    }

    private async scheduleOrFail(scheduleId: number): Promise<Schedule> {
        const schedule = await this.schedules.findOne({
            where: { id: scheduleId },
            relations: { entries: { match: true } },
            order: { entries: { position: "ASC" } },
        });
        if (!schedule) {
            throw new NotFoundException(`Schedule ${scheduleId} not found`);
        }

        return schedule;
    }

    private matchIdsOf(schedule: Schedule): number[] {
        return (schedule.entries ?? []).map((entry) => entry.match.id);
    }

    private async unassignedMatchIdsOf(tournamentId: number): Promise<number[]> {
        const rows: UnassignedMatchRow[] = await this.schedules.manager.query(UNASSIGNED_MATCH_IDS_OF_TOURNAMENT, [tournamentId]);

        return rows.map((row) => row.matchId);
    }

    private async tournamentIdOf(scheduleId: number): Promise<number> {
        const rows: Array<{ tournamentId: number }> = await this.schedules.manager.query(TOURNAMENT_ID_OF_SCHEDULE, [scheduleId]);
        if (!rows[0]) {
            throw new NotFoundException(`Schedule ${scheduleId} not found`);
        }

        return rows[0].tournamentId;
    }

    private toDto(schedule: Schedule, matchById: Map<number, MatchSummaryDto>): ScheduleDto {
        return {
            id: schedule.id,
            name: schedule.name,
            willStartAt: schedule.willStartAt.toISOString(),
            status: schedule.status,
            currentEntryId: schedule.currentEntryId,
            staleCode: schedule.staleCode as ScheduleStaleCode | null,
            staleDetails: schedule.staleDetails ?? null,
            interruptionCode: schedule.interruptionCode as ScheduleDto["interruptionCode"],
            interruptionDetails: schedule.interruptionDetails ?? null,
            interruptedAt: schedule.interruptedAt?.toISOString() ?? null,
            archivedAt: schedule.archivedAt?.toISOString() ?? null,
            version: schedule.version,
            entries: (schedule.entries ?? [])
                .sort((left, right) => left.position - right.position)
                .map((entry) => ({
                    id: entry.id,
                    position: entry.position,
                    expectedDurationMinutes: entry.expectedDurationMinutes,
                    startedAt: entry.startedAt?.toISOString() ?? null,
                    completedAt: entry.completedAt?.toISOString() ?? null,
                    match: matchById.get(entry.match.id),
                }))
                .filter((entry): entry is ScheduleDto["entries"][number] => Boolean(entry.match)),
        };
    }
}
