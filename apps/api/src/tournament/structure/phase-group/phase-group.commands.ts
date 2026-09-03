import { BadRequestException, Injectable } from '@nestjs/common';
import { Entrant } from '@tournament-manager/persistence';

import { UiUpdatePublisher } from '@tournament/shared/ui-update.publisher';
import { PhaseGroupAggregate, PhaseGroupDetails } from '@tournament/structure/phase-group/phase-group.aggregate';
import { PhaseGroupStore } from '@tournament/structure/phase-group/phase-group.store';
import { StructureVersionStore } from '@tournament/structure/structure-version.store';

/**
 * Every change a pool undergoes.
 *
 * Each command is the same four steps: load the aggregate once, apply the
 * change in memory, save once, publish once. There are four of them, and the
 * one that used to be the fifth is gone: `syncDerivedEntrants` copied the
 * entrants of the pool's matches into seat rows, one query and one save per
 * entrant, and every match write had to remember to call it. Pool membership is
 * derived from the matches when it is read instead, so nothing has to keep the
 * copy in step and no match write reaches into a pool any more.
 *
 * A pool announces two events when what it is changes, because two reads follow
 * it: the phase above it draws the list of its pools, and the pool itself draws
 * its own card.
 */
@Injectable()
export class PhaseGroupCommands {
    constructor(
        private readonly store: PhaseGroupStore,
        private readonly publisher: UiUpdatePublisher,
        private readonly versions: StructureVersionStore,
    ) {}

    /** Answers with the new pool id: the caller builds a bracket in what it made. */
    async create(phaseId: number, details: PhaseGroupDetails): Promise<number> {
        const phase = await this.store.loadPhase(phaseId);
        const phaseGroup = PhaseGroupAggregate.create(details, phase);

        await this.store.save(phaseGroup);
        await this.versions.bump(phaseGroup.address.divisionId);
        await this.publisher.emitPhaseUpdate(phaseGroup.phaseAddress);
        await this.publisher.emitPhaseGroupUpdate(phaseGroup.address);

        return phaseGroup.id;
    }

    async update(phaseGroupId: number, details: PhaseGroupDetails): Promise<void> {
        const phaseGroup = await this.store.loadOrFail(phaseGroupId);
        phaseGroup.describe(details);

        await this.store.save(phaseGroup);
        await this.versions.bump(phaseGroup.address.divisionId);
        await this.publisher.emitPhaseUpdate(phaseGroup.phaseAddress);
        await this.publisher.emitPhaseGroupUpdate(phaseGroup.address);
    }

    /**
     * A phase is never left without a pool: the last one goes when the phase
     * itself does. A phase holding one pool does not draw it, so deleting that
     * pool would ask somebody to remove a node they cannot see.
     */
    async delete(phaseGroupId: number): Promise<void> {
        const phaseGroup = await this.store.load(phaseGroupId);
        if (!phaseGroup) return;

        const phaseAddress = phaseGroup.phaseAddress;
        if (await this.store.countInPhase(phaseAddress.phaseId) <= 1) {
            throw new BadRequestException('A phase keeps at least one pool. Delete the phase instead.');
        }

        await this.store.remove(phaseGroup);
        await this.versions.bump(phaseAddress.divisionId);
        await this.publisher.emitPhaseUpdate(phaseAddress);
    }

    /**
     * The pool a generated bracket is built in.
     *
     * A phase created a moment ago holds one empty pool, and a bracket asked for
     * in that phase belongs in it: creating a second one would leave the empty
     * one beside it and make both visible, which is the node the phase was not
     * supposed to show. Once the phase holds competition, the bracket takes a
     * pool of its own.
     */
    async createForBracket(phaseId: number, bracketType: string): Promise<number> {
        const reusable = await this.store.findEmptySolePool(phaseId);
        if (!reusable) return this.create(phaseId, { bracketType });

        await this.update(reusable.id, { bracketType });

        return reusable.id;
    }

    /**
     * The seating a generated bracket produces, in the order it seats people.
     * One load and one save whatever the size of the pool; it used to be one
     * query and one save per entrant, after deleting every seat first.
     */
    async seatEntrants(phaseGroupId: number, entrants: Entrant[]): Promise<void> {
        const phaseGroup = await this.store.loadOrFail(phaseGroupId);
        phaseGroup.seat(entrants);

        await this.store.save(phaseGroup);
        await this.publisher.emitPhaseGroupUpdate(phaseGroup.address);
    }
}
