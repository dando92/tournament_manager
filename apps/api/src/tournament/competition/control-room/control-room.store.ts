import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { ControlRoomFlow, ControlRoomFlowEntry, Match, Tournament } from "@tournament-manager/persistence";

import { ControlRoomAggregate } from "./control-room.aggregate";

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

    async remove(flow: ControlRoomAggregate): Promise<void> {
        flow.assertEditable();
        await this.flows.remove(flow.entity);
    }

    async replaceEntries(flowId: number, version: number, matchIds: number[]): Promise<void> {
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

            const matches =
                matchIds.length > 0
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
                if (match.phaseGroup?.phase?.division?.tournament?.id !== flow.tournament.id) {
                    throw new ConflictException(`Match ${match.id} belongs to another tournament`);
                }
            }

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

            await manager.delete(ControlRoomFlowEntry, { flow: { id: flowId } });
            const replacement = matchIds.map((matchId, index) => {
                const entry = new ControlRoomFlowEntry();
                entry.flow = flow;
                entry.match = matchById.get(matchId);
                entry.position = index;

                return entry;
            });
            if (replacement.length > 0) {
                await manager.save(ControlRoomFlowEntry, replacement);
            }
            flow.currentEntryId = null;
            await manager.save(ControlRoomFlow, flow);
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
}
