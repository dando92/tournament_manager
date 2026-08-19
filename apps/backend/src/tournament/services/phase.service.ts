import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Division, Entrant, Phase } from '@persistence/entities';
import { CreatePhaseDto } from '../dtos';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';

@Injectable()
export class PhaseService {
    constructor(
        @InjectRepository(Phase)
        private readonly phaseRepository: Repository<Phase>,
        @InjectRepository(Division)
        private readonly divisionRepository: Repository<Division>,
        private readonly uiUpdateGateway: UiUpdatePublisher,
    ) {}

    async create(dto: CreatePhaseDto): Promise<Phase> {
        const division = await this.divisionRepository.findOneBy({ id: dto.divisionId });
        if (!division) throw new NotFoundException(`Division with ID ${dto.divisionId} not found`);

        const phase = new Phase();
        phase.name = dto.name;
        phase.division = division;

        const savedPhase = await this.phaseRepository.save(phase);
        await this.uiUpdateGateway.emitDivisionUpdateByDivisionId(dto.divisionId);
        return savedPhase;
    }

    async findOverviewDataForDivision(divisionId: number): Promise<Phase[]> {
        return this.phaseRepository.find({
            where: { division: { id: divisionId } },
            relations: {
                phaseGroups: {
                    entrants: {
                        entrant: {
                            participants: {
                                player: true,
                            },
                        },
                    },
                    matches: true,
                },
            },
        });
    }

    async getDivisionEntrants(id: number): Promise<Entrant[]> {
        const phase = await this.phaseRepository.findOne({
            where: { id },
            relations: {
                division: {
                    entrants: {
                        participants: {
                            player: true,
                        },
                    },
                },
            },
        });

        if (!phase) throw new NotFoundException(`Phase with ID ${id} not found`);
        return phase.division.entrants ?? [];
    }

    async delete(id: number): Promise<void> {
        const phase = await this.phaseRepository.findOne({
            where: { id },
            relations: { division: true },
        });

        if (!phase) throw new NotFoundException(`Phase with ID ${id} not found`);

        await this.phaseRepository.delete(id);
        await this.uiUpdateGateway.emitDivisionUpdateByDivisionId(phase.division.id);
    }
}
