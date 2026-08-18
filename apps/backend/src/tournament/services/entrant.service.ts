import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Division, Entrant, Participant } from '@persistence/entities';

@Injectable()
export class EntrantService {
    constructor(
        @InjectRepository(Entrant)
        private readonly entrantRepository: Repository<Entrant>,
        @InjectRepository(Division)
        private readonly divisionRepository: Repository<Division>,
        @InjectRepository(Participant)
        private readonly participantRepository: Repository<Participant>,
    ) {}

    async addSinglesEntrant(divisionId: number, participantId: number): Promise<Entrant> {
        const existing = await this.entrantRepository
            .createQueryBuilder('entrant')
            .leftJoinAndSelect('entrant.participants', 'participant')
            .leftJoinAndSelect('participant.player', 'player')
            .where('entrant.divisionId = :divisionId', { divisionId })
            .andWhere('participant.id = :participantId', { participantId })
            .getOne();

        if (existing) {
            if (existing.status !== 'active') existing.status = 'active';
            return this.entrantRepository.save(existing);
        }

        const division = await this.divisionRepository.findOneBy({ id: divisionId });
        if (!division) throw new NotFoundException(`Division ${divisionId} not found`);

        const participant = await this.participantRepository.findOne({
            where: { id: participantId },
            relations: { player: true },
        });
        if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);

        const entrant = new Entrant();
        entrant.division = division;
        entrant.name = participant.player.playerName;
        entrant.type = 'player';
        entrant.status = 'active';
        entrant.participants = [participant];
        return this.entrantRepository.save(entrant);
    }

    async removeSinglesEntrantByPlayer(divisionId: number, playerId: number): Promise<void> {
        const entrant = await this.entrantRepository
            .createQueryBuilder('entrant')
            .leftJoinAndSelect('entrant.participants', 'participant')
            .leftJoinAndSelect('participant.player', 'player')
            .where('entrant.divisionId = :divisionId', { divisionId })
            .andWhere('player.id = :playerId', { playerId })
            .getOne();

        if (!entrant) return;
        entrant.status = 'withdrawn';
        await this.entrantRepository.save(entrant);
    }

    async removeSinglesEntrantByParticipant(divisionId: number, participantId: number): Promise<void> {
        const entrant = await this.entrantRepository
            .createQueryBuilder('entrant')
            .leftJoinAndSelect('entrant.participants', 'participant')
            .where('entrant.divisionId = :divisionId', { divisionId })
            .andWhere('participant.id = :participantId', { participantId })
            .getOne();

        if (!entrant) return;
        entrant.status = 'withdrawn';
        await this.entrantRepository.save(entrant);
    }

}
