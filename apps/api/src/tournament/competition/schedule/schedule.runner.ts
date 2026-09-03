import { Injectable, NotFoundException } from "@nestjs/common";
import { DataSource, EntityManager, FindOptionsRelations, In } from "typeorm";
import { AdvancementRule, Schedule, ScheduleEntry, Match, Tournament } from "@tournament-manager/persistence";
import type { ScheduleInterruptionCode } from "@tournament-manager/contracts";

import { MatchAddress, MatchAggregate } from "@match/match.aggregate";
import { UiUpdatePublisher } from "@tournament/shared/ui-update.publisher";
import { ScheduleAggregate } from "./schedule.aggregate";
import { ScheduleMatchSnapshot, evaluateScheduleMatch } from "./schedule.eligibility";

const RUNNER_MATCH_GRAPH: FindOptionsRelations<Match> = {
    entrants: { participants: { player: true } },
    phaseGroup: { phase: { division: { tournament: true } } },
    rounds: { song: true, standings: { player: true } },
    tiebreaks: { song: true, standings: { player: true, score: true } },
    matchResult: true,
};

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
        AND s."status" IN ('running', 'paused')
`;

/** Every running schedule, which a restarted API reconciles against the database. */
const RUNNING_SCHEDULE_IDS = `
    SELECT   s."id" AS "id"
    FROM     "schedule" s
    WHERE    s."status" = 'running'
    ORDER BY s."id"
`;

/** The rows `ACTIVE_CONFLICTS` produces. */
type ActiveConflictRow = { matchId: number; playerId: number };

/**
 * Which other active match of the tournament already holds one of these
 * players. A player cannot be sent to two cabinets at once, so an entry waits
 * while another match has them.
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
        AND other."id" <> $2
        AND participant."playerId" = ANY($3::int[])
`;

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

        const entries = await manager.find(ScheduleEntry, {
            where: { schedule: { id: scheduleId } },
            relations: { match: true },
            order: { position: "ASC" },
        });
        const matchIds = entries.map((entry) => entry.match.id);
        const matches = matchIds.length > 0 ? await manager.find(Match, { where: { id: In(matchIds) }, relations: RUNNER_MATCH_GRAPH }) : [];
        const byId = new Map(matches.map((match) => [match.id, match]));
        const required = await this.requiredEntrants(manager, matchIds);
        const changed: Match[] = [];
        const currentIndex = schedule.currentEntryId
            ? Math.max(
                  entries.findIndex((entry) => entry.id === schedule.currentEntryId),
                  0,
              )
            : 0;

        for (let index = currentIndex; index < entries.length; index += 1) {
            const entry = entries[index];
            const match = byId.get(entry.match.id);
            if (!match) {
                ScheduleAggregate.of(schedule).waitAt(entry.id, "MATCH_REMOVED", { matchId: entry.match.id });
                await manager.save(Schedule, schedule);

                return { tournamentId: schedule.tournament.id, scheduleId, matchAddresses: changed.map((item) => this.addressOf(item)) };
            }
            if (match.phaseGroup?.phase?.division?.tournament?.id !== schedule.tournamentId) {
                ScheduleAggregate.of(schedule).waitAt(entry.id, "MATCH_OUTSIDE_TOURNAMENT", {
                    matchId: match.id,
                    matchName: match.name,
                });
                if (changed.length > 0) {
                    await manager.save(Match, changed);
                }
                await manager.save(Schedule, schedule);

                return { tournamentId: schedule.tournamentId, scheduleId, matchAddresses: changed.map((item) => this.addressOf(item)) };
            }

            const snapshot = await this.snapshot(manager, schedule, entry, match, required.get(match.id) ?? 2);
            const eligibility = evaluateScheduleMatch(snapshot);
            if (eligibility.kind === "passed") {
                if (!entry.completedAt) {
                    entry.completedAt = new Date();
                    await manager.save(ScheduleEntry, entry);
                }
                if (match.active) {
                    match.active = false;
                    changed.push(match);
                    await manager.save(Match, match);
                }
                continue;
            }
            if (eligibility.kind === "stale") {
                ScheduleAggregate.of(schedule).waitAt(entry.id, eligibility.code, eligibility.details);
                if (changed.length > 0) {
                    await manager.save(Match, changed);
                }
                await manager.save(Schedule, schedule);

                return { tournamentId: schedule.tournament.id, scheduleId, matchAddresses: changed.map((item) => this.addressOf(item)) };
            }

            if (!match.active) {
                match.active = true;
                changed.push(match);
                entry.startedAt = new Date();
                entry.completedAt = null;
                await manager.save(ScheduleEntry, entry);
            } else if (!entry.startedAt) {
                entry.startedAt = new Date();
                await manager.save(ScheduleEntry, entry);
            }
            ScheduleAggregate.of(schedule).activate(entry.id);
            if (changed.length > 0) {
                await manager.save(Match, changed);
            }
            await manager.save(Schedule, schedule);

            return { tournamentId: schedule.tournament.id, scheduleId, matchAddresses: changed.map((item) => this.addressOf(item)) };
        }

        ScheduleAggregate.of(schedule).complete();
        if (changed.length > 0) {
            await manager.save(Match, changed);
        }
        await manager.save(Schedule, schedule);

        return { tournamentId: schedule.tournament.id, scheduleId, matchAddresses: changed.map((item) => this.addressOf(item)) };
    }

    private async snapshot(
        manager: EntityManager,
        schedule: Schedule,
        entry: ScheduleEntry,
        match: Match,
        requiredEntrantCount: number,
    ): Promise<ScheduleMatchSnapshot> {
        const playerIds = (match.entrants ?? [])
            .filter((entrant) => entrant.type === "player")
            .map((entrant) => entrant.participants?.[0]?.player?.id)
            .filter((id): id is number => Number.isFinite(id));
        const rules = await manager.find(AdvancementRule, {
            where: { sourceKind: "match", sourceId: match.id },
        });
        const readyToCommit = MatchAggregate.of(match, rules).poolState.awaitingCommit;
        const conflicts = await this.activeConflicts(manager, schedule.tournament.id, match.id, playerIds);

        return {
            matchId: match.id,
            matchName: match.name,
            active: match.active,
            completed: Boolean(match.matchResult),
            readyToCommit,
            playerIds,
            roundCount: (match.rounds ?? []).length,
            requiredEntrantCount,
            blockingMatchIds: [...new Set(conflicts.map((row) => row.matchId))],
            blockingPlayerIds: [...new Set(conflicts.map((row) => row.playerId))],
            isCurrentEntry: schedule.currentEntryId === entry.id,
        };
    }

    private async requiredEntrants(manager: EntityManager, matchIds: number[]): Promise<Map<number, number>> {
        if (matchIds.length === 0) {
            return new Map();
        }
        const rules = await manager.find(AdvancementRule, {
            where: { targetKind: "match", targetId: In(matchIds) },
        });
        const required = new Map<number, number>();
        for (const rule of rules) {
            required.set(rule.targetId, Math.max(required.get(rule.targetId) ?? 2, rule.targetSlot));
        }

        return required;
    }

    private async activeConflicts(
        manager: EntityManager,
        tournamentId: number,
        matchId: number,
        playerIds: number[],
    ): Promise<ActiveConflictRow[]> {
        if (playerIds.length === 0) {
            return [];
        }

        return manager.query(ACTIVE_CONFLICTS, [tournamentId, matchId, playerIds]);
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
        const entry = await manager.findOne(ScheduleEntry, {
            where: { id: schedule.currentEntryId },
            relations: { match: RUNNER_MATCH_GRAPH },
        });
        if (!entry?.match?.active) {
            return [];
        }
        entry.match.active = false;
        await manager.save(Match, entry.match);

        return [this.addressOf(entry.match)];
    }

    private addressOf(match: Match): MatchAddress {
        const phaseGroup = match.phaseGroup;
        const phase = phaseGroup?.phase;
        const division = phase?.division;

        return {
            tournamentId: division?.tournament?.id,
            divisionId: division?.id,
            phaseId: phase?.id,
            phaseGroupId: phaseGroup?.id,
            matchId: match.id,
        };
    }

    private async announce(transition: ScheduleTransition): Promise<void> {
        await this.publisher.emitScheduleUpdate(transition.tournamentId, transition.scheduleId);
        for (const address of transition.matchAddresses) {
            await this.publisher.emitMatchUpdate(address);
        }
    }
}
