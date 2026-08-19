import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entrant, Phase, PhaseGroup, PhaseGroupEntrant } from '@persistence/entities';
import { CreatePhaseGroupDto, UpdatePhaseGroupDto } from '@tournament/dtos';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';

@Injectable()
export class PhaseGroupService {
    constructor(
        @InjectRepository(PhaseGroup)
        private readonly phaseGroupRepository: Repository<PhaseGroup>,
        @InjectRepository(PhaseGroupEntrant)
        private readonly phaseGroupEntrantRepository: Repository<PhaseGroupEntrant>,
        @InjectRepository(Phase)
        private readonly phaseRepository: Repository<Phase>,
        @InjectRepository(Entrant)
        private readonly entrantRepository: Repository<Entrant>,
        private readonly uiUpdateGateway: UiUpdatePublisher,
    ) {}

    async createForPhase(phaseId: number, dto: CreatePhaseGroupDto): Promise<PhaseGroup> {
        const phase = await this.phaseRepository.findOneBy({ id: phaseId });
        if (!phase) throw new NotFoundException(`Phase with ID ${phaseId} not found`);

        const phaseGroup = new PhaseGroup();
        phaseGroup.name = dto.name;
        phaseGroup.displayIdentifier = dto.displayIdentifier ?? null;
        phaseGroup.bracketType = dto.bracketType ?? null;
        phaseGroup.state = 'pending';
        phaseGroup.phase = phase;
        phaseGroup.entrants = [];
        const savedPhaseGroup = await this.phaseGroupRepository.save(phaseGroup);
        await this.uiUpdateGateway.emitPhaseUpdateByPhaseId(phase.id);
        await this.uiUpdateGateway.emitPhaseGroupUpdateByPhaseGroupId(savedPhaseGroup.id);
        return savedPhaseGroup;
    }

    async findByPhase(phaseId: number): Promise<PhaseGroup[]> {
        return this.phaseGroupRepository.find({
            where: { phase: { id: phaseId } },
            relations: {
                phase: {
                    division: true,
                },
                entrants: {
                    entrant: {
                        participants: {
                            player: true,
                        },
                    },
                },
                matches: true,
            },
            order: { id: 'ASC' },
        });
    }

    async findDefaultForPhase(phaseId: number): Promise<PhaseGroup | null> {
        return this.phaseGroupRepository.findOne({
            where: { phase: { id: phaseId } },
            order: { id: 'ASC' },
        });
    }

    async findOne(id: number): Promise<PhaseGroup | null> {
        return this.phaseGroupRepository.findOne({
            where: { id },
            relations: {
                phase: {
                    division: true,
                },
                entrants: {
                    entrant: {
                        participants: {
                            player: true,
                        },
                    },
                },
                matches: {
                    entrants: {
                        participants: {
                            player: true,
                        },
                    },
                    matchResult: true,
                },
            },
        });
    }

    async update(id: number, dto: UpdatePhaseGroupDto): Promise<PhaseGroup> {
        const phaseGroup = await this.findOne(id);
        if (!phaseGroup) throw new NotFoundException(`PhaseGroup with ID ${id} not found`);

        if (dto.name !== undefined) phaseGroup.name = dto.name;
        if (dto.displayIdentifier !== undefined) phaseGroup.displayIdentifier = dto.displayIdentifier;
        if (dto.bracketType !== undefined) phaseGroup.bracketType = dto.bracketType;
        if (dto.state !== undefined && ['pending', 'active', 'completed'].includes(dto.state)) {
            phaseGroup.state = dto.state as PhaseGroup['state'];
        }

        const savedPhaseGroup = await this.phaseGroupRepository.save(phaseGroup);
        await this.uiUpdateGateway.emitPhaseUpdateByPhaseId(savedPhaseGroup.phase?.id);
        await this.uiUpdateGateway.emitPhaseGroupUpdateByPhaseGroupId(savedPhaseGroup.id);
        return savedPhaseGroup;
    }

    async delete(id: number): Promise<void> {
        const phaseGroup = await this.phaseGroupRepository.findOne({
            where: { id },
            relations: { phase: true },
        });
        await this.phaseGroupRepository.delete(id);
        await this.uiUpdateGateway.emitPhaseUpdateByPhaseId(phaseGroup?.phase?.id);
    }

    async replaceEntrants(phaseGroupId: number, entrants: Entrant[]): Promise<void> {
        const phaseGroup = await this.phaseGroupRepository.findOneBy({ id: phaseGroupId });
        if (!phaseGroup) throw new NotFoundException(`PhaseGroup with ID ${phaseGroupId} not found`);

        await this.phaseGroupEntrantRepository.delete({ phaseGroup: { id: phaseGroupId } });

        for (const [index, entrant] of entrants.entries()) {
            const loadedEntrant = await this.entrantRepository.findOneBy({ id: entrant.id });
            if (!loadedEntrant) throw new NotFoundException(`Entrant with ID ${entrant.id} not found`);

            const phaseGroupEntrant = new PhaseGroupEntrant();
            phaseGroupEntrant.phaseGroup = phaseGroup;
            phaseGroupEntrant.entrant = loadedEntrant;
            phaseGroupEntrant.seedNum = index + 1;
            phaseGroupEntrant.slot = index + 1;
            phaseGroupEntrant.status = 'active';
            await this.phaseGroupEntrantRepository.save(phaseGroupEntrant);
        }
        await this.uiUpdateGateway.emitPhaseGroupUpdateByPhaseGroupId(phaseGroupId);
    }

    async updateSeeding(phaseGroupId: number, entrantIds: number[]): Promise<void> {
        const phaseGroup = await this.phaseGroupRepository.findOne({
            where: { id: phaseGroupId },
            relations: {
                entrants: {
                    entrant: true,
                },
            },
        });
        if (!phaseGroup) throw new NotFoundException(`PhaseGroup with ID ${phaseGroupId} not found`);

        const existingByEntrantId = new Map((phaseGroup.entrants ?? []).map((entry) => [entry.entrant.id, entry]));
        for (const [index, entrantId] of entrantIds.entries()) {
            let phaseGroupEntrant = existingByEntrantId.get(entrantId);
            if (!phaseGroupEntrant) {
                const entrant = await this.entrantRepository.findOneBy({ id: entrantId });
                if (!entrant) throw new NotFoundException(`Entrant with ID ${entrantId} not found`);
                phaseGroupEntrant = new PhaseGroupEntrant();
                phaseGroupEntrant.phaseGroup = phaseGroup;
                phaseGroupEntrant.entrant = entrant;
                phaseGroupEntrant.status = 'active';
            }
            phaseGroupEntrant.seedNum = index + 1;
            phaseGroupEntrant.slot = index + 1;
            await this.phaseGroupEntrantRepository.save(phaseGroupEntrant);
        }
        await this.uiUpdateGateway.emitPhaseGroupUpdateByPhaseGroupId(phaseGroupId);
    }

    async addEntrant(phaseGroupId: number, entrantId: number, slot?: number | null, sourceAdvancementRuleId?: number | null): Promise<void> {
        const phaseGroup = await this.phaseGroupRepository.findOneBy({ id: phaseGroupId });
        if (!phaseGroup) throw new NotFoundException(`PhaseGroup with ID ${phaseGroupId} not found`);

        const entrant = await this.entrantRepository.findOneBy({ id: entrantId });
        if (!entrant) throw new NotFoundException(`Entrant with ID ${entrantId} not found`);

        let phaseGroupEntrant = await this.phaseGroupEntrantRepository.findOne({
            where: { phaseGroup: { id: phaseGroupId }, entrant: { id: entrantId } },
            relations: { entrant: true, phaseGroup: true },
        });
        if (!phaseGroupEntrant) {
            phaseGroupEntrant = new PhaseGroupEntrant();
            phaseGroupEntrant.phaseGroup = phaseGroup;
            phaseGroupEntrant.entrant = entrant;
        }

        const resolvedSlot = slot ?? phaseGroupEntrant.slot ?? await this.getNextSlot(phaseGroupId);
        phaseGroupEntrant.slot = resolvedSlot;
        phaseGroupEntrant.seedNum = resolvedSlot;
        phaseGroupEntrant.status = 'active';
        if (sourceAdvancementRuleId) {
            phaseGroupEntrant.sourceAdvancementRule = { id: sourceAdvancementRuleId } as any;
        }
        await this.phaseGroupEntrantRepository.save(phaseGroupEntrant);
        await this.uiUpdateGateway.emitPhaseGroupUpdateByPhaseGroupId(phaseGroupId);
    }

    async removeEntrant(phaseGroupId: number, entrantId: number): Promise<void> {
        await this.phaseGroupEntrantRepository.delete({
            phaseGroup: { id: phaseGroupId },
            entrant: { id: entrantId },
        });
        await this.uiUpdateGateway.emitPhaseGroupUpdateByPhaseGroupId(phaseGroupId);
    }

    async markEntrantsAdvanced(phaseGroupId: number, entrantIds: number[]): Promise<void> {
        const entries = await this.phaseGroupEntrantRepository.find({
            where: { phaseGroup: { id: phaseGroupId } },
            relations: { entrant: true },
        });
        const advancedIds = new Set(entrantIds);
        for (const entry of entries) {
            entry.status = advancedIds.has(entry.entrant.id) ? 'advanced' : entry.status === 'advanced' ? 'active' : entry.status;
            await this.phaseGroupEntrantRepository.save(entry);
        }
        await this.uiUpdateGateway.emitPhaseGroupUpdateByPhaseGroupId(phaseGroupId);
    }

    async getEntrantsForBracket(phaseGroupId: number): Promise<Entrant[]> {
        const phaseGroup = await this.findOne(phaseGroupId);
        if (!phaseGroup) throw new NotFoundException(`PhaseGroup with ID ${phaseGroupId} not found`);
        return (phaseGroup.entrants ?? [])
            .filter((entry) => entry.status === 'active' || entry.status === 'pending')
            .sort((left, right) => (left.seedNum ?? Number.MAX_SAFE_INTEGER) - (right.seedNum ?? Number.MAX_SAFE_INTEGER))
            .map((entry) => entry.entrant);
    }

    async getEntrants(phaseGroupId: number): Promise<PhaseGroupEntrant[]> {
        const phaseGroup = await this.phaseGroupRepository.findOne({
            where: { id: phaseGroupId },
            relations: {
                entrants: {
                    entrant: {
                        participants: {
                            player: true,
                        },
                    },
                },
            },
        });
        if (!phaseGroup) throw new NotFoundException(`PhaseGroup with ID ${phaseGroupId} not found`);
        return phaseGroup.entrants ?? [];
    }

    private async getNextSlot(phaseGroupId: number): Promise<number> {
        const { max } = await this.phaseGroupEntrantRepository
            .createQueryBuilder('phaseGroupEntrant')
            .select('MAX(phaseGroupEntrant.slot)', 'max')
            .where('phaseGroupEntrant.phaseGroupId = :phaseGroupId', { phaseGroupId })
            .getRawOne<{ max: number | null }>();
        return Number(max ?? 0) + 1;
    }
}
