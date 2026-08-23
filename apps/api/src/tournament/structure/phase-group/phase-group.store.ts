import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsRelations, Repository } from 'typeorm';
import { Phase, PhaseGroup, PhaseGroupEntrant } from '@tournament-manager/persistence';

import { PhaseGroupAggregate } from '@tournament/structure/phase-group/phase-group.aggregate';

/**
 * The one definition of what a pool is when it is about to change.
 *
 * It reaches the tournament because every write publishes an event addressed by
 * it, holds the seats because seating and placing are changes to them, and
 * holds its matches with their results because a pool is finished when every
 * match in it is, and the standings that decide who leaves the pool are counted
 * from those results.
 */
const PHASE_GROUP_GRAPH: FindOptionsRelations<PhaseGroup> = {
    phase: { division: { tournament: true } },
    entrants: { entrant: true, sourceAdvancementRule: true },
    matches: { entrants: { participants: { player: true } }, matchResult: true },
};

/**
 * Loading and saving the pool aggregate.
 *
 * A command loads once, changes the graph in memory and saves once. The save is
 * one transaction: the seats the aggregate released are deleted, and the rest
 * of the graph goes back through the cascade `PhaseGroup.entrants` already
 * declares, instead of one row per entrant.
 */
@Injectable()
export class PhaseGroupStore {
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
        @InjectRepository(PhaseGroup)
        private readonly phaseGroups: Repository<PhaseGroup>,
        @InjectRepository(Phase)
        private readonly phases: Repository<Phase>,
    ) {}

    async load(id: number): Promise<PhaseGroupAggregate | null> {
        const phaseGroup = await this.phaseGroups.findOne({ where: { id }, relations: PHASE_GROUP_GRAPH });

        return phaseGroup ? PhaseGroupAggregate.of(phaseGroup) : null;
    }

    async loadOrFail(id: number): Promise<PhaseGroupAggregate> {
        const phaseGroup = await this.load(id);
        if (!phaseGroup) throw new NotFoundException(`PhaseGroup with ID ${id} not found`);

        return phaseGroup;
    }

    /**
     * Loaded with its division and tournament, so a new pool has an address, and
     * with the pools already there, because a new one takes the first letter
     * none of them holds.
     */
    async loadPhase(id: number): Promise<Phase> {
        const phase = await this.phases.findOne({
            where: { id },
            relations: { division: { tournament: true }, phaseGroups: true },
        });
        if (!phase) throw new NotFoundException(`Phase with ID ${id} not found`);

        return phase;
    }

    async save(phaseGroup: PhaseGroupAggregate): Promise<void> {
        const removals = phaseGroup.removals;

        await this.dataSource.transaction(async (manager) => {
            if (removals.length > 0) await manager.delete(PhaseGroupEntrant, removals);
            await manager.save(PhaseGroup, phaseGroup.entity);
        });

        phaseGroup.settle();
    }

    async remove(phaseGroup: PhaseGroupAggregate): Promise<void> {
        await this.phaseGroups.delete(phaseGroup.id);
    }
}
