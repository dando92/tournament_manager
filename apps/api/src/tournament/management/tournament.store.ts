import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsRelations, Repository } from 'typeorm';
import { Participant, Tournament } from '@tournament-manager/persistence';

import { TournamentAggregate } from '@tournament/management/tournament.aggregate';

/**
 * The one definition of what a tournament is when it is about to change.
 *
 * It holds its participants with the player each one is and the account each
 * one may sign in as, because registering somebody is a change to that list and
 * the rule that keeps it one row per person can only be applied against the
 * whole of it. The structure below — divisions, phases, pools and matches —
 * belongs to the aggregates that own it and is not loaded here.
 */
const TOURNAMENT_GRAPH: FindOptionsRelations<Tournament> = {
    participants: { player: true, account: true },
};

/**
 * Loading and saving the tournament aggregate.
 *
 * A command loads once, changes the graph in memory and saves once. The save is
 * one transaction: the participant a command unregistered is deleted, and the
 * rest goes back through the cascade `Tournament.participants` already
 * declares, instead of a save per person.
 */
@Injectable()
export class TournamentStore {
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
        @InjectRepository(Tournament)
        private readonly tournaments: Repository<Tournament>,
    ) {}

    async load(id: number): Promise<TournamentAggregate | null> {
        const tournament = await this.tournaments.findOne({ where: { id }, relations: TOURNAMENT_GRAPH });

        return tournament ? TournamentAggregate.of(tournament) : null;
    }

    async loadOrFail(id: number): Promise<TournamentAggregate> {
        const tournament = await this.load(id);
        if (!tournament) throw new NotFoundException(`Tournament with id ${id} not found`);

        return tournament;
    }

    async save(tournament: TournamentAggregate): Promise<void> {
        const removal = tournament.removal;

        await this.dataSource.transaction(async (manager) => {
            await manager.save(Tournament, tournament.entity);

            /* The tournament row released it above; the row itself is ours to
               drop. It is loaded with the entrants that point at it, because the
               link table is not an entity and only a removal that knows about
               those rows clears them before the participant goes. */
            if (removal) {
                const stored = await manager.findOne(Participant, { where: { id: removal.id }, relations: { entrants: true } });
                if (stored) await manager.remove(Participant, stored);
            }
        });

        tournament.settle();
    }
}
