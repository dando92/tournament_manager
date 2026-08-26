import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { ControlRoomCreationDto, ControlRoomEditorDto, ControlRoomFlowDto, ControlRoomStaleCode, MatchDto } from "@tournament-manager/contracts";
import { ControlRoomFlow } from "@tournament-manager/persistence";

import { MatchQueries } from "@match/match.queries";

/** The rows `ASSIGNED_MATCH_IDS_OF_TOURNAMENT` produces. */
type AssignedMatchRow = { matchId: number };

/**
 * Every match a flow of this tournament already holds, which is what both the
 * creation form and the editor subtract from the tournament's matches to offer
 * the rest.
 */
const ASSIGNED_MATCH_IDS_OF_TOURNAMENT = `
    SELECT  entry."matchId" AS "matchId"
    FROM    "control_room_flow_entry" entry
    JOIN    "control_room_flow" flow ON flow."id" = entry."flowId"
    WHERE   flow."tournamentId" = $1
`;

/** Which tournament a flow belongs to. */
const TOURNAMENT_ID_OF_FLOW = `
    SELECT  flow."tournamentId" AS "tournamentId"
    FROM    "control_room_flow" flow
    WHERE   flow."id" = $1
`;

@Injectable()
export class ControlRoomQueries {
    constructor(
        @InjectRepository(ControlRoomFlow) private readonly flows: Repository<ControlRoomFlow>,
        private readonly matches: MatchQueries,
    ) {}

    async forTournament(tournamentId: number): Promise<ControlRoomFlowDto[]> {
        const [flows, matches] = await Promise.all([
            this.flows.find({
                where: { tournament: { id: tournamentId } },
                relations: { entries: { match: true } },
                order: { id: "ASC", entries: { position: "ASC" } },
            }),
            this.matches.byTournament(tournamentId),
        ]);
        const matchById = new Map(matches.map((match) => [match.id, match]));

        return flows.map((flow) => this.toDto(flow, matchById));
    }

    async byId(flowId: number): Promise<ControlRoomFlowDto> {
        const flow = await this.flowOrFail(flowId);
        const tournamentId = await this.tournamentIdOf(flowId);
        const matches = await this.matches.byTournament(tournamentId);

        return this.toDto(flow, new Map(matches.map((match) => [match.id, match])));
    }

    async creation(tournamentId: number): Promise<ControlRoomCreationDto> {
        const [allMatches, assigned] = await Promise.all([
            this.matches.byTournament(tournamentId),
            this.flows.manager.query<AssignedMatchRow[]>(ASSIGNED_MATCH_IDS_OF_TOURNAMENT, [tournamentId]),
        ]);
        const assignedIds = new Set(assigned.map((entry) => entry.matchId));
        return { unassignedMatches: allMatches.filter((match) => !assignedIds.has(match.id)) };
    }

    async editor(flowId: number): Promise<ControlRoomEditorDto> {
        const flow = await this.flowOrFail(flowId);
        if (flow.status !== "inactive" || flow.archivedAt) {
            throw new ConflictException(`Control room flow ${flowId} is not editable`);
        }
        const tournamentId = await this.tournamentIdOf(flowId);
        const [allMatches, assigned] = await Promise.all([
            this.matches.byTournament(tournamentId),
            this.flows.manager.query<AssignedMatchRow[]>(ASSIGNED_MATCH_IDS_OF_TOURNAMENT, [tournamentId]),
        ]);
        const assignedIds = new Set(assigned.map((entry) => entry.matchId));
        const matchById = new Map(allMatches.map((match) => [match.id, match]));

        return {
            flow: this.toDto(flow, matchById),
            unassignedMatches: allMatches.filter((match) => !assignedIds.has(match.id)),
        };
    }

    private async flowOrFail(flowId: number): Promise<ControlRoomFlow> {
        const flow = await this.flows.findOne({
            where: { id: flowId },
            relations: { entries: { match: true } },
            order: { entries: { position: "ASC" } },
        });
        if (!flow) {
            throw new NotFoundException(`Control room flow ${flowId} not found`);
        }

        return flow;
    }

    private async tournamentIdOf(flowId: number): Promise<number> {
        const rows: Array<{ tournamentId: number }> = await this.flows.manager.query(TOURNAMENT_ID_OF_FLOW, [flowId]);
        if (!rows[0]) {
            throw new NotFoundException(`Control room flow ${flowId} not found`);
        }

        return rows[0].tournamentId;
    }

    private toDto(flow: ControlRoomFlow, matchById: Map<number, MatchDto>): ControlRoomFlowDto {
        return {
            id: flow.id,
            name: flow.name,
            willStartAt: flow.willStartAt.toISOString(),
            status: flow.status,
            currentEntryId: flow.currentEntryId,
            staleCode: flow.staleCode as ControlRoomStaleCode | null,
            staleDetails: flow.staleDetails ?? null,
            interruptionCode: flow.interruptionCode as ControlRoomFlowDto["interruptionCode"],
            interruptionDetails: flow.interruptionDetails ?? null,
            interruptedAt: flow.interruptedAt?.toISOString() ?? null,
            archivedAt: flow.archivedAt?.toISOString() ?? null,
            version: flow.version,
            entries: (flow.entries ?? [])
                .sort((left, right) => left.position - right.position)
                .map((entry) => ({
                    id: entry.id,
                    position: entry.position,
                    expectedDurationMinutes: entry.expectedDurationMinutes,
                    startedAt: entry.startedAt?.toISOString() ?? null,
                    completedAt: entry.completedAt?.toISOString() ?? null,
                    match: matchById.get(entry.match.id),
                }))
                .filter((entry): entry is ControlRoomFlowDto["entries"][number] => Boolean(entry.match)),
        };
    }
}
