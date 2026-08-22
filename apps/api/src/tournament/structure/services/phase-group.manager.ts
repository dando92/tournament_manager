import { Inject, Injectable } from '@nestjs/common';
import { PhaseGroup, PhaseGroupEntrant } from '@tournament-manager/persistence';
import { PhaseGroupDto, PhaseGroupEntrantDto } from '@tournament-manager/contracts';
import { CreatePhaseGroupDto, UpdatePhaseGroupDto } from '@tournament/dtos';
import { toEntrantDto } from '@tournament/shared/projections';
import { PhaseGroupService } from './phase-group.service';

@Injectable()
export class PhaseGroupManager {
    constructor(
        @Inject()
        private readonly phaseGroupService: PhaseGroupService,
    ) {}

    async createForPhase(phaseId: number, dto: CreatePhaseGroupDto): Promise<PhaseGroupDto> {
        return this.toDto(await this.phaseGroupService.createForPhase(phaseId, dto));
    }

    async getEntrants(id: number): Promise<PhaseGroupEntrantDto[]> {
        const entrants = await this.phaseGroupService.getEntrants(id);
        return this.bySeed(entrants);
    }

    async update(id: number, dto: UpdatePhaseGroupDto): Promise<PhaseGroupDto> {
        return this.toDto(await this.phaseGroupService.update(id, dto));
    }

    async delete(id: number): Promise<void> {
        await this.phaseGroupService.delete(id);
    }

    private toDto(phaseGroup: PhaseGroup): PhaseGroupDto {
        return {
            id: phaseGroup.id,
            name: phaseGroup.name,
            displayIdentifier: phaseGroup.displayIdentifier ?? null,
            bracketType: phaseGroup.bracketType ?? null,
            state: phaseGroup.state,
            matchCount: phaseGroup.matches?.length ?? 0,
            entrants: this.bySeed(phaseGroup.entrants ?? []),
            advancementRules: [],
        };
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
