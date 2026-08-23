import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Division, Phase } from '@tournament-manager/persistence';
import { CreatePhaseDto, UpdatePhaseDto } from '@tournament/dtos';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';
import { PhaseGroupCommands } from '@tournament/structure/phase-group/phase-group.commands';

/**
 * The phases of a division.
 *
 * A phase is not an aggregate of its own — it is a name and a position inside
 * the division that holds it — so what it publishes is a division event, and
 * the division it belongs to is loaded with its tournament to address that
 * event without a second lookup.
 */
@Injectable()
export class PhaseService {
    constructor(
        @InjectRepository(Phase)
        private readonly phaseRepository: Repository<Phase>,
        @InjectRepository(Division)
        private readonly divisionRepository: Repository<Division>,
        private readonly phaseGroups: PhaseGroupCommands,
        private readonly publisher: UiUpdatePublisher,
    ) {}

    async createWithDefaultPhaseGroup(dto: CreatePhaseDto): Promise<Phase> {
        const phase = await this.create(dto);
        await this.phaseGroups.create(phase.id, {});
        return phase;
    }

    async create(dto: CreatePhaseDto): Promise<Phase> {
        const division = await this.divisionRepository.findOne({
            where: { id: dto.divisionId },
            relations: { tournament: true },
        });
        if (!division) throw new NotFoundException(`Division with ID ${dto.divisionId} not found`);

        const phase = new Phase();
        phase.name = dto.name;
        phase.division = division;

        const savedPhase = await this.phaseRepository.save(phase);
        await this.publisher.emitDivisionUpdate({ tournamentId: division.tournament?.id, divisionId: division.id });
        return savedPhase;
    }

    async update(id: number, dto: UpdatePhaseDto): Promise<Phase> {
        const phase = await this.loadWithDivision(id);

        const name = dto.name?.trim();
        if (name) phase.name = name;

        const savedPhase = await this.phaseRepository.save(phase);
        await this.announce(phase);
        return savedPhase;
    }

    async delete(id: number): Promise<void> {
        const phase = await this.loadWithDivision(id);

        await this.phaseRepository.delete(id);
        await this.announce(phase);
    }

    private async loadWithDivision(id: number): Promise<Phase> {
        const phase = await this.phaseRepository.findOne({
            where: { id },
            relations: { division: { tournament: true } },
        });
        if (!phase) throw new NotFoundException(`Phase with ID ${id} not found`);

        return phase;
    }

    private async announce(phase: Phase): Promise<void> {
        await this.publisher.emitDivisionUpdate({
            tournamentId: phase.division?.tournament?.id,
            divisionId: phase.division?.id,
        });
    }
}
