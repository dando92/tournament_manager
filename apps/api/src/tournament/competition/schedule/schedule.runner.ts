import { Injectable, NotFoundException } from "@nestjs/common";
import { DataSource, EntityManager, In } from "typeorm";
import { Schedule, ScheduleEntry, Match, Tournament } from "@tournament-manager/persistence";
import type { MatchState } from "@tournament-manager/persistence";
import type { ScheduleInterruptionCode } from "@tournament-manager/contracts";

import { MatchAddress } from "@match/match.aggregate";
import { UiUpdatePublisher } from "@tournament/shared/ui-update.publisher";
import { ScheduleAggregate } from "./schedule.aggregate";
import { ScheduleConflicts, ScheduleMatchSnapshot, evaluateConflicts, evaluateLocalEligibility } from "./schedule.eligibility";

type ScheduleTransition = { tournamentId: number; scheduleId: number; matchAddresses: MatchAddress[] };

/** The schedule a match sits in, for the writes that recalculate after touching it. */
const SCHEDULE_ID_OF_MATCH = `
    SELECT  entry."scheduleId" AS "scheduleId"
    FROM    "schedule_entry" entry
    WHERE   entry."matchId" = $1
`;

/** The same for a set of matches, once per schedule rather than once per match. */
const SCHEDULE_IDS_OF_MATCHES = `
    SELECT DISTINCT entry."scheduleId" AS "scheduleId"
    FROM    "schedule_entry" entry
    WHERE   entry."matchId" = ANY($1::int[])
`;

/** The schedules of a tournament that are under way, which closing it has to stop. */
const OPERATIONAL_SCHEDULE_IDS_OF_TOURNAMENT = `
    SELECT  s."id" AS "id"
    FROM    "schedule" s
    WHERE   s."tournamentId" = $1
        AND s."status" = 'running'
`;

/** Every running schedule, which a restarted API reconciles against the database. */
const RUNNING_SCHEDULE_IDS = `
    SELECT   s."id" AS "id"
    FROM     "schedule" s
    WHERE    s."status" = 'running'
    ORDER BY s."id"
`;

/** The rows `SCHEDULE_ENTRY_SNAPSHOTS` produces, one per entry, in schedule order. */
type ScheduleEntryRow = {
    entryId: number;
    entryMatchId: number;
    startedAt: Date | null;
    completedAt: Date | null;
    matchId: number | null;
    matchName: string | null;
    active: boolean | null;
    state: MatchState | null;
    tournamentId: number | null;
    divisionId: number | null;
    phaseId: number | null;
    phaseGroupId: number | null;
    roundCount: number;
    playerIds: number[] | null;
    requiredEntrantCount: number;
};

/**
 * Everything a recalculation reads about the schedule it is walking.
 *
 * One row per entry, and every column the verdict below needs: where the match
 * stands, whether it is on a cabinet, how many rounds it holds, who plays in
 * it, how many entrants its incoming rules will eventually seat, and its
 * address. It used to be the seven-relation graph of every match of the
 * schedule, hydrated in full to answer, normally, one question about one of
 * them, followed by two more queries per entry inside the loop.
 *
 * `m."state"` is the column batch S introduced: `completed` and `ready` are the
 * two the schedule reads, and nothing here re-derives them. See
 * `PerformanceReadiness.md`, batch R.
 *
 * The match is joined on the left because the entry is what the schedule owns.
 * A row with no match cannot happen while the foreign key cascades, and the
 * verdict for it is written down rather than assumed.
 */
const SCHEDULE_ENTRY_SNAPSHOTS = `
    SELECT      entry."id"          AS "entryId",
                entry."matchId"     AS "entryMatchId",
                entry."startedAt"   AS "startedAt",
                entry."completedAt" AS "completedAt",
                m."id"              AS "matchId",
                m."name"            AS "matchName",
                m."active"          AS "active",
                m."state"           AS "state",
                ca."tournamentId"   AS "tournamentId",
                ca."divisionId"     AS "divisionId",
                ca."phaseId"        AS "phaseId",
                ca."phaseGroupId"   AS "phaseGroupId",
                COALESCE(rounds."count", 0)::int AS "roundCount",
                players."ids" AS "playerIds",
                GREATEST(COALESCE(slots."required", 0), 2)::int AS "requiredEntrantCount"
    FROM        "schedule_entry" entry
    LEFT JOIN   "match" m ON m."id" = entry."matchId"
    LEFT JOIN   "competition_address" ca ON ca."matchId" = m."id"
    LEFT JOIN   LATERAL (
                    SELECT  COUNT(*) AS "count"
                    FROM    "round" r
                    WHERE   r."matchId" = m."id"
                ) rounds ON TRUE
    LEFT JOIN   LATERAL (
                    SELECT  array_agg(seat."playerId" ORDER BY seat."entrantId") AS "ids"
                    FROM (
                        SELECT DISTINCT ON (e."id") e."id" AS "entrantId", pa."playerId"
                        FROM    "match_entrants_entrant" me
                        JOIN    "entrant" e ON e."id" = me."entrantId" AND e."type" = 'player'
                        JOIN    "entrant_participants_participant" ep ON ep."entrantId" = e."id"
                        JOIN    "participant" pa ON pa."id" = ep."participantId"
                        WHERE   me."matchId" = m."id"
                        ORDER   BY e."id", pa."id"
                    ) seat
                ) players ON TRUE
    LEFT JOIN   LATERAL (
                    SELECT  MAX(target."targetSlot") AS "required"
                    FROM    "advancement_rule" target
                    WHERE   target."targetKind" = 'match' AND target."targetId" = m."id"
                ) slots ON TRUE
    WHERE       entry."scheduleId" = $1
    ORDER BY    entry."position"
`;

/** The rows `ACTIVE_MATCH_OF_ENTRY` produces. */
type MatchAddressRow = {
    tournamentId: number;
    divisionId: number;
    phaseId: number;
    phaseGroupId: number;
    matchId: number;
};

/**
 * The match an entry holds, if it is on a cabinet right now, with its address.
 *
 * Stopping a schedule has to take its current match off the cabinet and say
 * where that match lives. Both are columns; loading the aggregate to reach them
 * was the same graph a recalculation used to load per entry.
 */
const ACTIVE_MATCH_OF_ENTRY = `
    SELECT  ca."tournamentId" AS "tournamentId",
            ca."divisionId"   AS "divisionId",
            ca."phaseId"      AS "phaseId",
            ca."phaseGroupId" AS "phaseGroupId",
            ca."matchId"      AS "matchId"
    FROM    "schedule_entry" entry
    JOIN    "match" m ON m."id" = entry."matchId" AND m."active" = TRUE
    JOIN    "competition_address" ca ON ca."matchId" = m."id"
    WHERE   entry."id" = $1
`;

/**
 * Every match of a schedule that is active, with its address.
 *
 * A schedule holds one at a time, so this normally returns one row or none.
 * More than one means something outside the schedule activated a match of its
 * own while the schedule was inactive, which is what starting has to undo.
 */
const ACTIVE_MATCHES_OF_SCHEDULE = `
    SELECT  ca."tournamentId" AS "tournamentId",
            ca."divisionId"   AS "divisionId",
            ca."phaseId"      AS "phaseId",
            ca."phaseGroupId" AS "phaseGroupId",
            ca."matchId"      AS "matchId"
    FROM    "schedule_entry" entry
    JOIN    "match" m ON m."id" = entry."matchId" AND m."active" = TRUE
    JOIN    "competition_address" ca ON ca."matchId" = m."id"
    WHERE   entry."scheduleId" = $1
`;

/** The rows `ACTIVE_CONFLICTS` produces. */
type ActiveConflictRow = { matchId: number; playerId: number };

/**
 * Which other active match of the tournament already holds one of these
 * players. A player cannot be sent to two cabinets at once, so an entry waits
 * while another match has them.
 *
 * It runs once per recalculation, for the entry that passed every other check,
 * because that is the only entry whose answer is read.
 *
 * The excluded ids are the entry's own match and every match this recalculation
 * has already decided to take off the cabinet. Those are still `active` in the
 * database — they are written once, at the end — and a match the walk has just
 * finished with is not an obstacle to the one that follows it. The predecessor
 * of an entry usually holds exactly the same people.
 */
const ACTIVE_CONFLICTS = `
    SELECT DISTINCT other."id" AS "matchId",
            participant."playerId" AS "playerId"
    FROM    "competition_address" ca
    JOIN    "match" other ON other."id" = ca."matchId"
    JOIN    "match_entrants_entrant" me ON me."matchId" = other."id"
    JOIN    "entrant_participants_participant" ep ON ep."entrantId" = me."entrantId"
    JOIN    "participant" ON participant."id" = ep."participantId"
    WHERE   ca."tournamentId" = $1
        AND other."active" = TRUE
        AND other."id" <> ALL($2::int[])
        AND participant."playerId" = ANY($3::int[])
`;

/** One entry of the schedule, as the walk below reads it. */
type ScheduleEntrySnapshot = {
    entryId: number;
    entryMatchId: number;
    matchExists: boolean;
    tournamentId: number | null;
    startedAt: Date | null;
    completedAt: Date | null;
    address: MatchAddress;
    match: ScheduleMatchSnapshot;
};

@Injectable()
export class ScheduleRunner {
    constructor(
        private readonly dataSource: DataSource,
        private readonly publisher: UiUpdatePublisher,
    ) {}

    async recalculateForMatch(matchId: number): Promise<void> {
        const rows: Array<{ scheduleId: number }> = await this.dataSource.query(SCHEDULE_ID_OF_MATCH, [matchId]);
        if (rows[0]) {
            await this.recalculate(rows[0].scheduleId);
        }
    }

    async recalculateForMatches(matchIds: number[]): Promise<void> {
        if (matchIds.length === 0) {
            return;
        }
        const rows: Array<{ scheduleId: number }> = await this.dataSource.query(SCHEDULE_IDS_OF_MATCHES, [matchIds]);
        for (const { scheduleId } of rows) {
            await this.recalculate(scheduleId);
        }
    }

    async recalculate(scheduleId: number): Promise<void> {
        const transition = await this.dataSource.transaction((manager) => this.recalculateLocked(manager, scheduleId));
        await this.announce(transition);
    }

    /**
     * Takes every match of the schedule out of the active state.
     *
     * Starting calls this before the walk. A schedule decides which of its
     * matches is active, and it is the only writer of that column for them
     * while it runs — but between a stop and the next start it owns nothing,
     * and a match may be activated by hand. This is where the schedule takes
     * them back, so the walk cannot leave a second one active beside the one it
     * picks: live runs are attributed by looking among the active matches, and
     * two of them make that ambiguous.
     */
    async deactivateEveryMatch(scheduleId: number): Promise<void> {
        const addresses = await this.dataSource.transaction(async (manager) => {
            const rows: MatchAddressRow[] = await manager.query(ACTIVE_MATCHES_OF_SCHEDULE, [scheduleId]);
            if (rows.length === 0) {
                return [];
            }
            const addresses = rows.map((row) => this.addressOf(row));
            await manager.update(Match, { id: In(addresses.map((address) => address.matchId)) }, { active: false });

            return addresses;
        });

        for (const address of addresses) {
            await this.publisher.emitMatchUpdate(address);
        }
    }

    async stop(scheduleId: number, interruptionCode?: ScheduleInterruptionCode, interruptionDetails?: Record<string, unknown>): Promise<void> {
        const transition = await this.dataSource.transaction(async (manager) => {
            const schedule = await this.loadScheduleForUpdate(manager, scheduleId);
            const aggregate = ScheduleAggregate.of(schedule);
            aggregate.stop(interruptionCode, interruptionDetails);
            const addresses = await this.deactivateCurrent(manager, schedule);
            await manager.save(Schedule, schedule);

            return { tournamentId: schedule.tournamentId, scheduleId, matchAddresses: addresses };
        });
        await this.announce(transition);
    }

    async interruptCompleted(scheduleId: number, entryId: number, matchId: number): Promise<void> {
        const transition = await this.dataSource.transaction(async (manager) => {
            const schedule = await this.loadScheduleForUpdate(manager, scheduleId);
            const entry = await manager.findOne(ScheduleEntry, { where: { id: entryId, schedule: { id: scheduleId }, match: { id: matchId } } });
            if (!entry) {
                throw new NotFoundException(`Schedule entry ${entryId} not found`);
            }
            ScheduleAggregate.of(schedule).interruptCompletedRun(entryId, "MATCH_RESULT_REOPENED", { matchId });
            await manager.save(Schedule, schedule);

            return { tournamentId: schedule.tournamentId, scheduleId, matchAddresses: [] };
        });
        await this.announce(transition);
    }

    async stopTournament(tournamentId: number): Promise<void> {
        const ids: Array<{ id: number }> = await this.dataSource.query(OPERATIONAL_SCHEDULE_IDS_OF_TOURNAMENT, [tournamentId]);
        for (const { id } of ids) {
            await this.stop(id, "TOURNAMENT_CLOSED", { tournamentId });
        }
    }

    async reconcileRunning(): Promise<void> {
        const rows: Array<{ id: number }> = await this.dataSource.query(RUNNING_SCHEDULE_IDS);
        for (const { id } of rows) {
            await this.recalculate(id);
        }
    }

    /**
     * Where the schedule stands, decided from the current entry onwards.
     *
     * The walk stops at the first entry that is not already settled: it either
     * puts that match on the cabinet or records why it cannot. Entries passed on
     * the way are completed and taken off the cabinet, and the writes they imply
     * are issued once, at the end, by `settle`.
     */
    private async recalculateLocked(manager: EntityManager, scheduleId: number): Promise<ScheduleTransition> {
        const schedule = await this.loadScheduleForUpdate(manager, scheduleId);
        if (schedule.status !== "running") {
            return { tournamentId: schedule.tournamentId, scheduleId, matchAddresses: [] };
        }

        schedule.tournament = await manager.findOneByOrFail(Tournament, { id: schedule.tournamentId });
        if (schedule.tournament.status !== "open") {
            const addresses = await this.deactivateCurrent(manager, schedule);
            ScheduleAggregate.of(schedule).stop("TOURNAMENT_CLOSED", { tournamentId: schedule.tournamentId });
            await manager.save(Schedule, schedule);

            return { tournamentId: schedule.tournamentId, scheduleId, matchAddresses: addresses };
        }

        const rows: ScheduleEntryRow[] = await manager.query(SCHEDULE_ENTRY_SNAPSHOTS, [scheduleId]);
        const entries = rows.map((row) => this.entryOf(row, schedule.currentEntryId));
        const aggregate = ScheduleAggregate.of(schedule);
        const deactivated: ScheduleEntrySnapshot[] = [];
        const currentIndex = schedule.currentEntryId
            ? Math.max(
                  entries.findIndex((entry) => entry.entryId === schedule.currentEntryId),
                  0,
              )
            : 0;

        for (let index = currentIndex; index < entries.length; index += 1) {
            const entry = entries[index];
            if (!entry.matchExists) {
                aggregate.waitAt(entry.entryId, "MATCH_REMOVED", { matchId: entry.entryMatchId });

                return this.settle(manager, schedule, scheduleId, deactivated, null);
            }
            if (entry.tournamentId !== schedule.tournamentId) {
                aggregate.waitAt(entry.entryId, "MATCH_OUTSIDE_TOURNAMENT", {
                    matchId: entry.match.matchId,
                    matchName: entry.match.matchName,
                });

                return this.settle(manager, schedule, scheduleId, deactivated, null);
            }

            const local = evaluateLocalEligibility(entry.match);
            if (local.kind === "passed") {
                if (!entry.completedAt) {
                    await manager.update(ScheduleEntry, { id: entry.entryId }, { completedAt: new Date() });
                }
                if (entry.match.active) {
                    deactivated.push(entry);
                }
                continue;
            }
            if (local.kind === "stale") {
                aggregate.waitAt(entry.entryId, local.code, local.details);

                return this.settle(manager, schedule, scheduleId, deactivated, null);
            }

            const verdict = evaluateConflicts(entry.match, await this.conflictsOf(manager, schedule.tournamentId, entry, deactivated));
            if (verdict.kind === "stale") {
                aggregate.waitAt(entry.entryId, verdict.code, verdict.details);

                return this.settle(manager, schedule, scheduleId, deactivated, null);
            }

            if (!entry.match.active) {
                await manager.update(ScheduleEntry, { id: entry.entryId }, { startedAt: new Date(), completedAt: null });
            } else if (!entry.startedAt) {
                await manager.update(ScheduleEntry, { id: entry.entryId }, { startedAt: new Date() });
            }
            aggregate.activate(entry.entryId);

            return this.settle(manager, schedule, scheduleId, deactivated, entry.match.active ? null : entry);
        }

        aggregate.complete();

        return this.settle(manager, schedule, scheduleId, deactivated, null);
    }

    /**
     * The writes a verdict produces, and the events it owes.
     *
     * Every exit of the walk above passes through here, so a match that came off
     * the cabinet is written on every one of them, and it is written once: the
     * deactivations are a single statement rather than a save inside the loop
     * and a second one after it.
     */
    private async settle(
        manager: EntityManager,
        schedule: Schedule,
        scheduleId: number,
        deactivated: ScheduleEntrySnapshot[],
        activated: ScheduleEntrySnapshot | null,
    ): Promise<ScheduleTransition> {
        if (deactivated.length > 0) {
            await manager.update(Match, { id: In(deactivated.map((entry) => entry.match.matchId)) }, { active: false });
        }
        if (activated) {
            await manager.update(Match, { id: activated.match.matchId }, { active: true });
        }
        await manager.save(Schedule, schedule);

        const changed = activated ? [...deactivated, activated] : deactivated;

        return { tournamentId: schedule.tournamentId, scheduleId, matchAddresses: changed.map((entry) => entry.address) };
    }

    /** One row of `SCHEDULE_ENTRY_SNAPSHOTS`, as everything above reads an entry. */
    private entryOf(row: ScheduleEntryRow, currentEntryId: number | null): ScheduleEntrySnapshot {
        const entryId = Number(row.entryId);

        return {
            entryId,
            entryMatchId: Number(row.entryMatchId),
            matchExists: row.matchId !== null,
            tournamentId: row.tournamentId === null ? null : Number(row.tournamentId),
            startedAt: row.startedAt,
            completedAt: row.completedAt,
            address: {
                tournamentId: Number(row.tournamentId),
                divisionId: Number(row.divisionId),
                phaseId: Number(row.phaseId),
                phaseGroupId: Number(row.phaseGroupId),
                matchId: Number(row.matchId),
            },
            match: {
                matchId: Number(row.matchId),
                matchName: row.matchName ?? "",
                active: Boolean(row.active),
                /* The two states the schedule reads. Both are settled: one has
                   its result written, the other can have it written as it is. */
                completed: row.state === "completed",
                readyToCommit: row.state === "ready",
                playerIds: (row.playerIds ?? []).map(Number),
                roundCount: Number(row.roundCount),
                requiredEntrantCount: Number(row.requiredEntrantCount),
                isCurrentEntry: entryId === currentEntryId,
            },
        };
    }

    private async conflictsOf(
        manager: EntityManager,
        tournamentId: number,
        entry: ScheduleEntrySnapshot,
        deactivated: ScheduleEntrySnapshot[],
    ): Promise<ScheduleConflicts> {
        const settled = [entry.match.matchId, ...deactivated.map((passed) => passed.match.matchId)];
        const rows: ActiveConflictRow[] = await manager.query(ACTIVE_CONFLICTS, [tournamentId, settled, entry.match.playerIds]);

        return {
            blockingMatchIds: [...new Set(rows.map((row) => Number(row.matchId)))],
            blockingPlayerIds: [...new Set(rows.map((row) => Number(row.playerId)))],
        };
    }

    private async loadScheduleForUpdate(manager: EntityManager, scheduleId: number): Promise<Schedule> {
        const schedule = await manager.findOne(Schedule, {
            where: { id: scheduleId },
            lock: { mode: "pessimistic_write" },
        });
        if (!schedule) {
            throw new NotFoundException(`Schedule ${scheduleId} not found`);
        }

        return schedule;
    }

    private async deactivateCurrent(manager: EntityManager, schedule: Schedule): Promise<MatchAddress[]> {
        if (!schedule.currentEntryId) {
            return [];
        }
        const rows: MatchAddressRow[] = await manager.query(ACTIVE_MATCH_OF_ENTRY, [schedule.currentEntryId]);
        if (rows.length === 0) {
            return [];
        }

        const address = this.addressOf(rows[0]);
        await manager.update(Match, { id: address.matchId }, { active: false });

        return [address];
    }

    /** One address row, as everything that publishes a match event reads it. */
    private addressOf(row: MatchAddressRow): MatchAddress {
        return {
            tournamentId: Number(row.tournamentId),
            divisionId: Number(row.divisionId),
            phaseId: Number(row.phaseId),
            phaseGroupId: Number(row.phaseGroupId),
            matchId: Number(row.matchId),
        };
    }

    private async announce(transition: ScheduleTransition): Promise<void> {
        await this.publisher.emitScheduleUpdate(transition.tournamentId, transition.scheduleId);
        for (const address of transition.matchAddresses) {
            await this.publisher.emitMatchUpdate(address);
        }
    }
}
