import { Injectable, NotFoundException } from "@nestjs/common";
import { DataSource, EntityManager, FindOptionsRelations, In } from "typeorm";
import { AdvancementRule, ControlRoomFlow, ControlRoomFlowEntry, Match, Tournament } from "@tournament-manager/persistence";
import type { ControlRoomInterruptionCode } from "@tournament-manager/contracts";

import { MatchAddress } from "@match/match.aggregate";
import { UiUpdatePublisher } from "@tournament/shared/ui-update.publisher";
import { ControlRoomAggregate } from "./control-room.aggregate";
import { ControlRoomMatchSnapshot, evaluateControlRoomMatch } from "./control-room.eligibility";

const RUNNER_MATCH_GRAPH: FindOptionsRelations<Match> = {
    entrants: { participants: { player: true } },
    phaseGroup: { phase: { division: { tournament: true } } },
    rounds: { song: true, standings: { player: true } },
    matchResult: true,
};

type FlowTransition = { tournamentId: number; flowId: number; matchAddresses: MatchAddress[] };

@Injectable()
export class ControlRoomRunner {
    constructor(
        private readonly dataSource: DataSource,
        private readonly publisher: UiUpdatePublisher,
    ) {}

    async recalculateForMatch(matchId: number): Promise<void> {
        const rows: Array<{ flowId: number }> = await this.dataSource.query(`SELECT "flowId" FROM "control_room_flow_entry" WHERE "matchId" = $1`, [matchId]);
        if (rows[0]) {
            await this.recalculate(rows[0].flowId);
        }
    }

    async recalculateForMatches(matchIds: number[]): Promise<void> {
        if (matchIds.length === 0) {
            return;
        }
        const rows: Array<{ flowId: number }> = await this.dataSource.query(
            `SELECT DISTINCT "flowId" FROM "control_room_flow_entry" WHERE "matchId" = ANY($1::int[])`,
            [matchIds],
        );
        for (const { flowId } of rows) {
            await this.recalculate(flowId);
        }
    }

    async recalculate(flowId: number): Promise<void> {
        const transition = await this.dataSource.transaction((manager) => this.recalculateLocked(manager, flowId));
        await this.announce(transition);
    }

    async stop(flowId: number, interruptionCode?: ControlRoomInterruptionCode, interruptionDetails?: Record<string, unknown>): Promise<void> {
        const transition = await this.dataSource.transaction(async (manager) => {
            const flow = await this.loadFlowForUpdate(manager, flowId);
            const aggregate = ControlRoomAggregate.of(flow);
            aggregate.stop(interruptionCode, interruptionDetails);
            const addresses = await this.deactivateCurrent(manager, flow);
            await manager.save(ControlRoomFlow, flow);

            return { tournamentId: flow.tournamentId, flowId, matchAddresses: addresses };
        });
        await this.announce(transition);
    }

    async interruptCompleted(flowId: number, entryId: number, matchId: number): Promise<void> {
        const transition = await this.dataSource.transaction(async (manager) => {
            const flow = await this.loadFlowForUpdate(manager, flowId);
            const entry = await manager.findOne(ControlRoomFlowEntry, { where: { id: entryId, flow: { id: flowId }, match: { id: matchId } } });
            if (!entry) {
                throw new NotFoundException(`Control room flow entry ${entryId} not found`);
            }
            ControlRoomAggregate.of(flow).interruptCompletedRun(entryId, "MATCH_RESULT_REOPENED", { matchId });
            await manager.save(ControlRoomFlow, flow);

            return { tournamentId: flow.tournamentId, flowId, matchAddresses: [] };
        });
        await this.announce(transition);
    }

    async stopTournament(tournamentId: number): Promise<void> {
        const ids: Array<{ id: number }> = await this.dataSource.query(
            `SELECT id FROM "control_room_flow" WHERE "tournamentId" = $1 AND status IN ('running', 'paused')`,
            [tournamentId],
        );
        for (const { id } of ids) {
            await this.stop(id, "TOURNAMENT_CLOSED", { tournamentId });
        }
    }

    async reconcileRunning(): Promise<void> {
        const rows: Array<{ id: number }> = await this.dataSource.query(`SELECT id FROM "control_room_flow" WHERE status = 'running' ORDER BY id`);
        for (const { id } of rows) {
            await this.recalculate(id);
        }
    }

    private async recalculateLocked(manager: EntityManager, flowId: number): Promise<FlowTransition> {
        const flow = await this.loadFlowForUpdate(manager, flowId);
        if (flow.status !== "running") {
            return { tournamentId: flow.tournamentId, flowId, matchAddresses: [] };
        }

        flow.tournament = await manager.findOneByOrFail(Tournament, { id: flow.tournamentId });
        if (flow.tournament.status !== "open") {
            const addresses = await this.deactivateCurrent(manager, flow);
            ControlRoomAggregate.of(flow).stop("TOURNAMENT_CLOSED", { tournamentId: flow.tournamentId });
            await manager.save(ControlRoomFlow, flow);

            return { tournamentId: flow.tournamentId, flowId, matchAddresses: addresses };
        }

        const entries = await manager.find(ControlRoomFlowEntry, {
            where: { flow: { id: flowId } },
            relations: { match: true },
            order: { position: "ASC" },
        });
        const matchIds = entries.map((entry) => entry.match.id);
        const matches = matchIds.length > 0 ? await manager.find(Match, { where: { id: In(matchIds) }, relations: RUNNER_MATCH_GRAPH }) : [];
        const byId = new Map(matches.map((match) => [match.id, match]));
        const required = await this.requiredEntrants(manager, matchIds);
        const changed: Match[] = [];
        const currentIndex = flow.currentEntryId
            ? Math.max(
                  entries.findIndex((entry) => entry.id === flow.currentEntryId),
                  0,
              )
            : 0;

        for (let index = currentIndex; index < entries.length; index += 1) {
            const entry = entries[index];
            const match = byId.get(entry.match.id);
            if (!match) {
                ControlRoomAggregate.of(flow).waitAt(entry.id, "MATCH_REMOVED", { matchId: entry.match.id });
                await manager.save(ControlRoomFlow, flow);

                return { tournamentId: flow.tournament.id, flowId, matchAddresses: changed.map((item) => this.addressOf(item)) };
            }
            if (match.phaseGroup?.phase?.division?.tournament?.id !== flow.tournamentId) {
                ControlRoomAggregate.of(flow).waitAt(entry.id, "MATCH_OUTSIDE_TOURNAMENT", {
                    matchId: match.id,
                    matchName: match.name,
                });
                if (changed.length > 0) {
                    await manager.save(Match, changed);
                }
                await manager.save(ControlRoomFlow, flow);

                return { tournamentId: flow.tournamentId, flowId, matchAddresses: changed.map((item) => this.addressOf(item)) };
            }

            const snapshot = await this.snapshot(manager, flow, entry, match, required.get(match.id) ?? 2);
            const eligibility = evaluateControlRoomMatch(snapshot);
            if (eligibility.kind === "passed") {
                if (!entry.completedAt) {
                    entry.completedAt = new Date();
                    await manager.save(ControlRoomFlowEntry, entry);
                }
                if (match.active) {
                    match.active = false;
                    changed.push(match);
                    await manager.save(Match, match);
                }
                continue;
            }
            if (eligibility.kind === "stale") {
                ControlRoomAggregate.of(flow).waitAt(entry.id, eligibility.code, eligibility.details);
                if (changed.length > 0) {
                    await manager.save(Match, changed);
                }
                await manager.save(ControlRoomFlow, flow);

                return { tournamentId: flow.tournament.id, flowId, matchAddresses: changed.map((item) => this.addressOf(item)) };
            }

            if (!match.active) {
                match.active = true;
                changed.push(match);
                entry.startedAt = new Date();
                entry.completedAt = null;
                await manager.save(ControlRoomFlowEntry, entry);
            } else if (!entry.startedAt) {
                entry.startedAt = new Date();
                await manager.save(ControlRoomFlowEntry, entry);
            }
            ControlRoomAggregate.of(flow).activate(entry.id);
            if (changed.length > 0) {
                await manager.save(Match, changed);
            }
            await manager.save(ControlRoomFlow, flow);

            return { tournamentId: flow.tournament.id, flowId, matchAddresses: changed.map((item) => this.addressOf(item)) };
        }

        ControlRoomAggregate.of(flow).complete();
        if (changed.length > 0) {
            await manager.save(Match, changed);
        }
        await manager.save(ControlRoomFlow, flow);

        return { tournamentId: flow.tournament.id, flowId, matchAddresses: changed.map((item) => this.addressOf(item)) };
    }

    private async snapshot(
        manager: EntityManager,
        flow: ControlRoomFlow,
        entry: ControlRoomFlowEntry,
        match: Match,
        requiredEntrantCount: number,
    ): Promise<ControlRoomMatchSnapshot> {
        const playerIds = (match.entrants ?? [])
            .filter((entrant) => entrant.type === "player")
            .map((entrant) => entrant.participants?.[0]?.player?.id)
            .filter((id): id is number => Number.isFinite(id));
        const readyToCommit = this.isReadyToCommit(match, playerIds);
        const conflicts = await this.activeConflicts(manager, flow.tournament.id, match.id, playerIds);

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
            isCurrentEntry: flow.currentEntryId === entry.id,
        };
    }

    private isReadyToCommit(match: Match, playerIds: number[]): boolean {
        if (playerIds.length === 0 || (match.rounds ?? []).length === 0) {
            return false;
        }

        return match.rounds.every((round) =>
            round.song
                ? playerIds.every((playerId) => (round.standings ?? []).some((standing) => standing.player?.id === playerId))
                : (round.standings ?? []).some((standing) => standing.points > 0),
        );
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
    ): Promise<Array<{ matchId: number; playerId: number }>> {
        if (playerIds.length === 0) {
            return [];
        }

        return manager.query(
            `SELECT DISTINCT other.id AS "matchId", participant."playerId" AS "playerId"
             FROM "match" other
             JOIN phase_group pg ON pg.id = other."phaseGroupId"
             JOIN phase p ON p.id = pg."phaseId"
             JOIN division d ON d.id = p."divisionId"
             JOIN match_entrants_entrant me ON me."matchId" = other.id
             JOIN entrant_participants_participant ep ON ep."entrantId" = me."entrantId"
             JOIN participant ON participant.id = ep."participantId"
             WHERE d."tournamentId" = $1 AND other.active = TRUE AND other.id <> $2
               AND participant."playerId" = ANY($3::int[])`,
            [tournamentId, matchId, playerIds],
        );
    }

    private async loadFlowForUpdate(manager: EntityManager, flowId: number): Promise<ControlRoomFlow> {
        const flow = await manager.findOne(ControlRoomFlow, {
            where: { id: flowId },
            lock: { mode: "pessimistic_write" },
        });
        if (!flow) {
            throw new NotFoundException(`Control room flow ${flowId} not found`);
        }

        return flow;
    }

    private async deactivateCurrent(manager: EntityManager, flow: ControlRoomFlow): Promise<MatchAddress[]> {
        if (!flow.currentEntryId) {
            return [];
        }
        const entry = await manager.findOne(ControlRoomFlowEntry, {
            where: { id: flow.currentEntryId },
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

    private async announce(transition: FlowTransition): Promise<void> {
        await this.publisher.emitControlRoomFlowUpdate(transition.tournamentId, transition.flowId);
        for (const address of transition.matchAddresses) {
            await this.publisher.emitMatchUpdate(address);
        }
    }
}
