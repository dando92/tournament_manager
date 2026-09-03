import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { StructurePlan, StructurePlanAppliedDto } from '@tournament-manager/contracts';

import { StructurePlanStore } from '@tournament/structure/plan/structure-plan.store';
import { orderedForWriting, validateStructurePlan } from '@tournament/structure/plan/structure-plan.validation';
import { StructureVersionStore } from '@tournament/structure/structure-version.store';
import { UiUpdatePublisher } from '@tournament/shared/ui-update.publisher';

/** The kinds the applier writes. The rest of a plan is somebody else's job. */
const WRITABLE_KINDS = ['division', 'phase', 'phaseGroup', 'match'];

/**
 * Applying a structure plan.
 *
 * Three things produce a plan and this is what writes one, so the checks a
 * client-supplied write graph needs are here rather than in each producer:
 * the graph has to be a structure, the rows it links to have to exist and
 * belong to this tournament, and the versions it was computed against have to
 * be the ones still in the database.
 */
@Injectable()
export class StructurePlanCommands {
    constructor(
        private readonly store: StructurePlanStore,
        private readonly versions: StructureVersionStore,
        private readonly publisher: UiUpdatePublisher,
    ) {}

    async apply(tournamentId: number, plan: StructurePlan): Promise<StructurePlanAppliedDto> {
        if (plan.tournamentId !== tournamentId) {
            throw new BadRequestException('The plan was computed for another tournament.');
        }

        const unsupported = plan.nodes.filter((node) => !WRITABLE_KINDS.includes(node.kind) && node.action !== 'skip');
        if (unsupported.length > 0) {
            throw new BadRequestException(
                `A plan applied here carries structure only. It also carries ${[...new Set(unsupported.map((node) => node.kind))].join(', ')}.`,
            );
        }

        const errors = validateStructurePlan(plan);
        const ordering = orderedForWriting(plan);
        const reasons = [...errors, ...ordering.errors];
        if (reasons.length > 0) {
            throw new BadRequestException(reasons);
        }

        await this.assertBasisIsCurrent(plan);

        const applied = await this.store.apply(tournamentId, plan, ordering.nodes);

        /* One event for the whole plan. The tree re-reads the tournament, which
           is what a plan changed, instead of ninety separate invalidations. */
        await this.publisher.emitTournamentUpdate(tournamentId);

        return { tournamentId, rowIdByLocalId: applied.rowIdByLocalId };
    }

    /**
     * A plan states the version of each division it read. If one has moved, the
     * rows it names may be gone and the shape it drew is not the shape that is
     * there, so it is refused and recomputed rather than merged.
     */
    private async assertBasisIsCurrent(plan: StructurePlan): Promise<void> {
        if (plan.basedOn.length === 0) {
            return;
        }

        const current = await this.versions.versionsOf(plan.basedOn.map((basis) => basis.divisionId));
        const moved = plan.basedOn.filter((basis) => current.get(basis.divisionId) !== basis.structureVersion);
        if (moved.length === 0) {
            return;
        }

        throw new ConflictException(
            `The structure changed while this plan was open: ${moved
                .map((basis) => `division ${basis.divisionId}`)
                .join(', ')}. Read it again and rebuild the plan.`,
        );
    }
}
