import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from '@persistence/entities';
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

    async findByNameNormalized(playerName: string): Promise<Player | null> {
        const normalized = playerName.trim().toLowerCase();
        const players = await this.playerRepo.find();
        return players.find((candidate) => candidate.playerName.trim().toLowerCase() === normalized) ?? null;
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
