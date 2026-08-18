import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PhaseGroup, PhaseGroupEntrant } from '@persistence/entities';
import {
    CreatePhaseGroupDto,
    UpdatePhaseGroupDto,
    UpdatePhaseGroupSeedingDto,
} from '@tournament/dtos';
import { DivisionSummaryPhaseGroupDto } from '@tournament/dtos/division-summary.dto';
import { PhaseGroupService } from './phase-group.service';

@Injectable()
export class PhaseGroupManager {
    constructor(
        @Inject()
        private readonly phaseGroupService: PhaseGroupService,
    ) {}

    async createForPhase(phaseId: number, dto: CreatePhaseGroupDto): Promise<DivisionSummaryPhaseGroupDto> {
        return this.toDto(await this.phaseGroupService.createForPhase(phaseId, dto));
    }

    async findByPhase(phaseId: number): Promise<DivisionSummaryPhaseGroupDto[]> {
        const phaseGroups = await this.phaseGroupService.findByPhase(phaseId);
        return phaseGroups.map((phaseGroup) => this.toDto(phaseGroup));
    }

    async findOne(id: number): Promise<DivisionSummaryPhaseGroupDto> {
        const phaseGroup = await this.phaseGroupService.findOne(id);
        if (!phaseGroup) throw new NotFoundException(`PhaseGroup with ID ${id} not found`);
        return this.toDto(phaseGroup);
    }

    async getEntrants(id: number): Promise<DivisionSummaryPhaseGroupDto['entrants']> {
        const entrants = await this.phaseGroupService.getEntrants(id);
        return entrants
            .sort((left, right) => (left.seedNum ?? Number.MAX_SAFE_INTEGER) - (right.seedNum ?? Number.MAX_SAFE_INTEGER))
            .map((entry) => this.toEntrantDto(entry));
    }

    async update(id: number, dto: UpdatePhaseGroupDto): Promise<DivisionSummaryPhaseGroupDto> {
        return this.toDto(await this.phaseGroupService.update(id, dto));
    }

    async delete(id: number): Promise<void> {
        await this.phaseGroupService.delete(id);
    }

    async addEntrant(phaseGroupId: number, entrantId: number): Promise<void> {
        await this.phaseGroupService.addEntrant(phaseGroupId, entrantId);
    }

    async removeEntrant(phaseGroupId: number, entrantId: number): Promise<void> {
        await this.phaseGroupService.removeEntrant(phaseGroupId, entrantId);
    }

    async updateSeeding(phaseGroupId: number, dto: UpdatePhaseGroupSeedingDto): Promise<void> {
        await this.phaseGroupService.updateSeeding(phaseGroupId, dto.entrantIds);
    }

    private toDto(phaseGroup: PhaseGroup): DivisionSummaryPhaseGroupDto {
        return {
            id: phaseGroup.id,
            name: phaseGroup.name,
            displayIdentifier: phaseGroup.displayIdentifier ?? null,
            bracketType: phaseGroup.bracketType ?? null,
            state: phaseGroup.state,
            matchCount: phaseGroup.matches?.length ?? 0,
            entrants: (phaseGroup.entrants ?? [])
                .sort((left, right) => (left.seedNum ?? Number.MAX_SAFE_INTEGER) - (right.seedNum ?? Number.MAX_SAFE_INTEGER))
                .map((entry) => this.toEntrantDto(entry)),
            advancementRules: [],
        };
    }

    private toEntrantDto(entry: PhaseGroupEntrant) {
        return {
            id: entry.id,
            seedNum: entry.seedNum ?? null,
            slot: entry.slot ?? null,
            status: entry.status,
            entrant: {
                id: entry.entrant.id,
                name: entry.entrant.name,
                type: entry.entrant.type,
                status: entry.entrant.status,
                participants: (entry.entrant.participants ?? []).map((participant) => ({
                    id: participant.id,
                    roles: participant.roles ?? [],
                    status: participant.status,
                    player: {
                        id: participant.player.id,
                        playerName: participant.player.playerName,
                    },
                })),
            },
        };
    }
}
