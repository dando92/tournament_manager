import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { ControlRoomCreationDto, ControlRoomEditorDto, ControlRoomFlowDto, ControlRoomStaleCode, MatchDto } from "@tournament-manager/contracts";
import { ControlRoomFlow } from "@tournament-manager/persistence";

import { MatchQueries } from "@match/match.queries";

/** The rows `UNASSIGNED_MATCH_IDS_OF_TOURNAMENT` produces. */
type UnassignedMatchRow = { matchId: number };

/**
 * Every match of the tournament that no flow of it holds yet, which is what
 * both the creation form and the editor offer.
 *
 * The subtraction is a `NOT EXISTS` rather than a projection of every match of
 * the tournament filtered in memory: only the matches actually offered are
 * projected afterwards, through `MatchQueries.byIds`.
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
                FROM    "control_room_flow_entry" entry
                JOIN    "control_room_flow" flow ON flow."id" = entry."flowId"
                WHERE   entry."matchId" = m."id" AND flow."tournamentId" = $1
             )
    ORDER BY m."id"
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
        const matches = await this.matches.byIds(this.matchIdsOf(flow));

        return this.toDto(flow, new Map(matches.map((match) => [match.id, match])));
    }

    async creation(tournamentId: number): Promise<ControlRoomCreationDto> {
        const unassignedIds = await this.unassignedMatchIdsOf(tournamentId);

        return { unassignedMatches: await this.matches.byIds(unassignedIds) };
    }

    async editor(flowId: number): Promise<ControlRoomEditorDto> {
        const flow = await this.flowOrFail(flowId);
        if (flow.status !== "inactive" || flow.archivedAt) {
            throw new ConflictException(`Control room flow ${flowId} is not editable`);
        }
        const tournamentId = await this.tournamentIdOf(flowId);
        const unassignedIds = await this.unassignedMatchIdsOf(tournamentId);
        const flowMatchIds = this.matchIdsOf(flow);
        const matches = await this.matches.byIds([...new Set([...flowMatchIds, ...unassignedIds])]);
        const matchById = new Map(matches.map((match) => [match.id, match]));
        const unassigned = new Set(unassignedIds);

        return {
            flow: this.toDto(flow, matchById),
            unassignedMatches: matches.filter((match) => unassigned.has(match.id)),
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

    private matchIdsOf(flow: ControlRoomFlow): number[] {
        return (flow.entries ?? []).map((entry) => entry.match.id);
    }

    private async unassignedMatchIdsOf(tournamentId: number): Promise<number[]> {
        const rows: UnassignedMatchRow[] = await this.flows.manager.query(UNASSIGNED_MATCH_IDS_OF_TOURNAMENT, [tournamentId]);

        return rows.map((row) => row.matchId);
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
