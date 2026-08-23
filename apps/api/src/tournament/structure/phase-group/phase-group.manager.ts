import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PhaseGroupEntrant } from '@tournament-manager/persistence';
import { PhaseGroupDto, PhaseGroupEntrantDto } from '@tournament-manager/contracts';
import { CreatePhaseGroupDto, UpdatePhaseGroupDto } from '@tournament/dtos';
import { toEntrantDto } from '@tournament/shared/projections';
import { TreeQueries } from '@tournament/structure/tree.queries';
import { PhaseGroupService } from '@tournament/structure/phase-group/phase-group.service';

@Injectable()
export class PhaseGroupManager {
    constructor(
        @Inject()
        private readonly phaseGroupService: PhaseGroupService,
        private readonly treeQueries: TreeQueries,
    ) {}

    async createForPhase(phaseId: number, dto: CreatePhaseGroupDto): Promise<PhaseGroupDto> {
        return this.project((await this.phaseGroupService.createForPhase(phaseId, dto)).id);
    }

    async getEntrants(id: number): Promise<PhaseGroupEntrantDto[]> {
        const entrants = await this.phaseGroupService.getEntrants(id);
        return this.bySeed(entrants);
    }

    async update(id: number, dto: UpdatePhaseGroupDto): Promise<PhaseGroupDto> {
        return this.project((await this.phaseGroupService.update(id, dto)).id);
    }

    async delete(id: number): Promise<void> {
        await this.phaseGroupService.delete(id);
    }

    /** A pool mutation answers with the node the tree draws, which is what its `GET` returns. */
    private async project(phaseGroupId: number): Promise<PhaseGroupDto> {
        const phaseGroup = await this.treeQueries.phaseGroup(phaseGroupId);
        if (!phaseGroup) throw new NotFoundException(`Phase group ${phaseGroupId} not found`);

        return phaseGroup;
    }

    /** An unseeded entrant sorts last, so a partially seeded pool still reads in order. */
    private bySeed(entrants: PhaseGroupEntrant[]): PhaseGroupEntrantDto[] {
        return [...entrants]
            .sort((left, right) => (left.seedNum ?? Number.MAX_SAFE_INTEGER) - (right.seedNum ?? Number.MAX_SAFE_INTEGER))
            .map((entry) => this.toEntrantSeatDto(entry));
    }

    private toEntrantSeatDto(entry: PhaseGroupEntrant): PhaseGroupEntrantDto {
        return {
            id: entry.id,
            seedNum: entry.seedNum ?? null,
            slot: entry.slot ?? null,
            status: entry.status,
            entrant: toEntrantDto(entry.entrant),
        };
    }
}
