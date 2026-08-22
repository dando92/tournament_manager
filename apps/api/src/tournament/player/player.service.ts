import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from '@tournament-manager/persistence';
import { UpdatePlayerDto } from '@player/player.dto';

@Injectable()
export class PlayerService {
    constructor(
        @InjectRepository(Player)
        private readonly playerRepo: Repository<Player>,
    ) {}

    async findAll(): Promise<Player[]> {
        return this.playerRepo.find();
    }

    async findById(id: number): Promise<Player | null> {
        return this.playerRepo.findOneBy({ id });
    }

    async findByName(playerName: string): Promise<Player | null> {
        return this.playerRepo.findOneBy({ playerName });
    }

    /**
     * The player whose name matches once trimmed and lowercased on both sides.
     *
     * It used to load the whole catalogue and filter it in memory, which is what
     * `TournamentManager.createParticipant` did inline as well. Two players
     * normalizing to the same name would be a defect in the catalogue rather
     * than a choice to make here, so the older of the two wins and the answer
     * stays deterministic.
     */
    async findByNameNormalized(playerName: string): Promise<Player | null> {
        const [player] = await this.playerRepo
            .createQueryBuilder('player')
            .where('LOWER(TRIM(player.playerName)) = :normalized', { normalized: playerName.trim().toLowerCase() })
            .orderBy('player.id', 'ASC')
            .limit(1)
            .getMany();

        return player ?? null;
    }

    async create(playerName: string): Promise<Player> {
        const player = new Player();
        player.playerName = playerName;
        return this.playerRepo.save(player);
    }

    async update(id: number, dto: UpdatePlayerDto): Promise<Player> {
        const player = await this.playerRepo.findOneBy({ id });
        if (!player) throw new NotFoundException(`Player with id ${id} not found`);
        this.playerRepo.merge(player, dto);
        return this.playerRepo.save(player);
    }

    async delete(id: number): Promise<void> {
        await this.playerRepo.delete(id);
    }
}
