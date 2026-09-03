import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Division } from '@tournament-manager/persistence';
import { In, Repository } from 'typeorm';

/**
 * How many times the shape of a division has changed.
 *
 * A structure plan is computed against a version and refused if it has moved,
 * so a preview left open while somebody else edits is not written against rows
 * it never saw. The counter moves on a change of shape and on nothing else: a
 * score is not a change of shape, and a plan does not go stale because a match
 * was played while somebody was looking at it.
 *
 * The bump is one statement rather than a read and a write, so two structural
 * writes landing together cannot lose one of them.
 */
@Injectable()
export class StructureVersionStore {
    constructor(
        @InjectRepository(Division)
        private readonly divisions: Repository<Division>,
    ) {}

    async bump(divisionId: number | null | undefined): Promise<void> {
        if (!divisionId) {
            return;
        }

        await this.divisions.increment({ id: divisionId }, 'structureVersion', 1);
    }

    async versionsOf(divisionIds: number[]): Promise<Map<number, number>> {
        if (divisionIds.length === 0) {
            return new Map();
        }

        const divisions = await this.divisions.find({
            where: { id: In(divisionIds) },
            select: { id: true, structureVersion: true },
        });

        return new Map(divisions.map((division) => [division.id, division.structureVersion]));
    }
}
