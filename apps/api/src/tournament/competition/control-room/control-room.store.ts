import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { ControlRoomFlow, ControlRoomFlowEntry, Match, Tournament } from "@tournament-manager/persistence";

import { ControlRoomAggregate } from "./control-room.aggregate";

export type ControlRoomEntryInput = { matchId: number; expectedDurationMinutes: number };

/**
 * Moves every entry of a flow out of the way before the new order is written.
 *
 * Position is unique per flow, so writing the replacement order directly would
 * collide with the order being replaced. The offset is larger than any flow
 * will ever hold.
 */
const PARK_ENTRY_POSITIONS = `
    UPDATE  "control_room_flow_entry"
    SET     "position" = "position" + 1000000
    WHERE   "flowId" = $1
`;

@Injectable()
export class ControlRoomStore {
    constructor(
        private readonly dataSource: DataSource,
        @InjectRepository(ControlRoomFlow) private readonly flows: Repository<ControlRoomFlow>,
        @InjectRepository(ControlRoomFlowEntry) private readonly entries: Repository<ControlRoomFlowEntry>,
        @InjectRepository(Tournament) private readonly tournaments: Repository<Tournament>,
        @InjectRepository(Match) private readonly matches: Repository<Match>,
    ) {}

    async load(id: number): Promise<ControlRoomAggregate | null> {
        const flow = await this.flows.findOne({
            where: { id },
            relations: { tournament: true, entries: { match: true } },
            order: { entries: { position: "ASC" } },
        });

        return flow ? ControlRoomAggregate.of(flow) : null;
    }

    async loadOrFail(id: number): Promise<ControlRoomAggregate> {
        const flow = await this.load(id);
        if (!flow) {
            throw new NotFoundException(`Control room flow ${id} not found`);
        }

        return flow;
    }

    async loadTournament(id: number): Promise<Tournament> {
        const tournament = await this.tournaments.findOneBy({ id });
        if (!tournament) {
            throw new NotFoundException(`Tournament ${id} not found`);
        }

        return tournament;
    }

    async save(flow: ControlRoomAggregate): Promise<void> {
        await this.flows.save(flow.entity);
    }

    async create(tournamentId: number, name: string, willStartAt: Date, defaultExpectedDurationMinutes: number, matchIds: number[]): Promise<number> {
        return this.dataSource.transaction(async (manager) => {
            const tournament = await manager.findOneBy(Tournament, { id: tournamentId });
            if (!tournament) {
                throw new NotFoundException(`Tournament ${tournamentId} not found`);
            }
            const matches = await this.validatedMatches(manager, tournamentId, matchIds);
            const assignedCount = matchIds.length > 0
                ? await manager.count(ControlRoomFlowEntry, { where: { match: { id: In(matchIds) } } })
                : 0;
            if (assignedCount > 0) {
                throw new ConflictException("One or more matches already belong to a control room flow");
            }
            const aggregate = ControlRoomAggregate.create(name, willStartAt, tournament);
            await manager.save(ControlRoomFlow, aggregate.entity);
            const entries = matches.map((match, position) => {
                const entry = new ControlRoomFlowEntry();
                entry.flow = aggregate.entity;
                entry.match = match;
                entry.position = position;
                entry.expectedDurationMinutes = defaultExpectedDurationMinutes;
                entry.startedAt = null;
                entry.completedAt = null;
                return entry;
            });
            if (entries.length > 0) {
                await manager.save(ControlRoomFlowEntry, entries);
            }

            return aggregate.id;
        });
    }

    async remove(flow: ControlRoomAggregate): Promise<void> {
        flow.assertEditable();
        await this.flows.remove(flow.entity);
    }

    async replaceEntries(flowId: number, version: number, inputs: ControlRoomEntryInput[]): Promise<void> {
        const matchIds = inputs.map((input) => input.matchId);
        if (new Set(matchIds).size !== matchIds.length) {
            throw new ConflictException("A match can appear only once in a control room flow");
        }

        await this.dataSource.transaction(async (manager) => {
            const flow = await manager.findOne(ControlRoomFlow, {
                where: { id: flowId },
                lock: { mode: "pessimistic_write" },
            });
            if (!flow) {
                throw new NotFoundException(`Control room flow ${flowId} not found`);
            }
            const aggregate = ControlRoomAggregate.of(flow);
            aggregate.assertEditable();
            if (flow.version !== version) {
                throw new ConflictException("The control room flow changed; reload it before saving the order");
            }

            flow.tournament = await manager.findOneByOrFail(Tournament, { id: flow.tournamentId });

            const matches = await this.validatedMatches(manager, flow.tournament.id, matchIds);
            const matchById = new Map(matches.map((match) => [match.id, match]));

            const assignments =
                matchIds.length > 0
                    ? await manager.find(ControlRoomFlowEntry, {
                          where: { match: { id: In(matchIds) } },
                          relations: { flow: true, match: true },
                      })
                    : [];
            const foreignFlowIds = [...new Set(assignments.filter((entry) => entry.flow.id !== flowId).map((entry) => entry.flow.id))];
            if (foreignFlowIds.length > 0) {
                const foreignFlows = await manager.find(ControlRoomFlow, { where: { id: In(foreignFlowIds) } });
                if (foreignFlows.some((candidate) => candidate.status !== "inactive")) {
                    throw new ConflictException("Matches can move only between inactive control room flows");
                }
                await manager.delete(ControlRoomFlowEntry, { flow: { id: In(foreignFlowIds) }, match: { id: In(matchIds) } });
            }

            const existing = await manager.find(ControlRoomFlowEntry, { where: { flow: { id: flowId } }, relations: { match: true } });
            const existingByMatchId = new Map(existing.map((entry) => [entry.match.id, entry]));
            const removed = existing.filter((entry) => !matchIds.includes(entry.match.id));
            if (removed.length > 0) {
                await manager.remove(ControlRoomFlowEntry, removed);
            }
            if (existing.length > 0) {
                await manager.query(PARK_ENTRY_POSITIONS, [flowId]);
            }
            const replacement = inputs.map((input, index) => {
                const entry = existingByMatchId.get(input.matchId) ?? new ControlRoomFlowEntry();
                entry.flow = flow;
                entry.match = matchById.get(input.matchId);
                entry.position = index;
                entry.expectedDurationMinutes = input.expectedDurationMinutes;
                entry.startedAt ??= null;
                entry.completedAt ??= null;

                return entry;
            });
            if (replacement.length > 0) {
                await manager.save(ControlRoomFlowEntry, replacement);
            }
            flow.currentEntryId = null;
            await manager.save(ControlRoomFlow, flow);
        });
    }

    async updateExpectedDuration(flowId: number, entryId: number, expectedDurationMinutes: number): Promise<void> {
        await this.dataSource.transaction(async (manager) => {
            const flow = await manager.findOneBy(ControlRoomFlow, { id: flowId });
            if (!flow) {
                throw new NotFoundException(`Control room flow ${flowId} not found`);
            }
            if (flow.status === "completed" || flow.archivedAt) {
                throw new ConflictException(`Control room flow ${flowId} no longer accepts timing changes`);
            }
            const entry = await manager.findOne(ControlRoomFlowEntry, { where: { id: entryId, flow: { id: flowId } } });
            if (!entry) {
                throw new NotFoundException(`Control room flow entry ${entryId} not found`);
            }
            entry.expectedDurationMinutes = expectedDurationMinutes;
            await manager.save(ControlRoomFlowEntry, entry);
        });
    }

    async flowIdForMatch(matchId: number): Promise<number | null> {
        const entry = await this.entries.findOne({ where: { match: { id: matchId } }, relations: { flow: true } });

        return entry?.flow?.id ?? null;
    }

    async operationalFlowIds(tournamentId: number): Promise<number[]> {
        const flows = await this.flows.find({
            where: { tournament: { id: tournamentId }, status: In(["running", "paused"]) },
            select: { id: true },
        });

        return flows.map((flow) => flow.id);
    }

    private async validatedMatches(manager: DataSource["manager"], tournamentId: number, matchIds: number[]): Promise<Match[]> {
        if (new Set(matchIds).size !== matchIds.length) {
            throw new ConflictException("A match can appear only once in a control room flow");
        }
        const matches = matchIds.length > 0
            ? await manager.find(Match, {
                  where: { id: In(matchIds) },
                  relations: { phaseGroup: { phase: { division: { tournament: true } } } },
              })
            : [];
        if (matches.length !== matchIds.length) {
            throw new NotFoundException("One or more matches no longer exist");
        }
        const matchById = new Map(matches.map((match) => [match.id, match]));
        for (const match of matches) {
            if (match.phaseGroup?.phase?.division?.tournament?.id !== tournamentId) {
                throw new ConflictException(`Match ${match.id} belongs to another tournament`);
            }
        }

        return matchIds.map((matchId) => matchById.get(matchId));
    }
}
