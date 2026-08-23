import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsRelations, In, Repository } from 'typeorm';
import { Division, Participant, Tournament } from '@tournament-manager/persistence';

import { DivisionAggregate } from '@tournament/structure/division/division.aggregate';

/**
 * The one definition of what a division is when it is about to change.
 *
 * It holds the tournament because every write publishes an event addressed by
 * it, the roster because admitting and seeding are changes to it, and the
 * phases because a generated bracket is numbered after the ones already there.
 * The structure below a phase belongs to the pool and the match, and is not
 * loaded here: this graph used to reach every round of every match, which is
 * five levels the write side never touched.
 */
const DIVISION_GRAPH: FindOptionsRelations<Division> = {
    tournament: true,
    phases: true,
    entrants: { participants: { player: true } },
};

/**
 * Loading and saving the division aggregate.
 *
 * A command loads once, changes the graph in memory and saves once. The save is
 * one transaction and one call: `Division` cascades into its entrants, so the
 * roster goes back the way it came instead of one row at a time.
 */
@Injectable()
export class DivisionStore {
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
        @InjectRepository(Division)
        private readonly divisions: Repository<Division>,
        @InjectRepository(Tournament)
        private readonly tournaments: Repository<Tournament>,
        @InjectRepository(Participant)
        private readonly participants: Repository<Participant>,
    ) {}

    async load(id: number): Promise<DivisionAggregate | null> {
        const division = await this.divisions.findOne({ where: { id }, relations: DIVISION_GRAPH });

        return division ? DivisionAggregate.of(division) : null;
    }

    async loadOrFail(id: number): Promise<DivisionAggregate> {
        const division = await this.load(id);
        if (!division) throw new NotFoundException(`Division ${id} not found`);

        return division;
    }

    async loadTournament(id: number): Promise<Tournament> {
        const tournament = await this.tournaments.findOneBy({ id });
        if (!tournament) throw new NotFoundException(`Tournament ${id} not found`);

        return tournament;
    }

    /**
     * Loaded with their players, because an entrant is named after one. One
     * query whatever the count, answered in the order the caller asked for.
     */
    async loadParticipants(ids: number[]): Promise<Participant[]> {
        if (ids.length === 0) return [];

        const found = await this.participants.find({ where: { id: In(ids) }, relations: { player: true } });
        const byId = new Map(found.map((participant) => [participant.id, participant]));

        return ids.map((id) => {
            const participant = byId.get(id);
            if (!participant) throw new NotFoundException(`Participant ${id} not found`);

            return participant;
        });
    }

    async save(division: DivisionAggregate): Promise<void> {
        await this.dataSource.transaction(async (manager) => {
            await manager.save(Division, division.entity);
        });
    }

    async remove(division: DivisionAggregate): Promise<void> {
        await this.divisions.delete(division.id);
    }
}
