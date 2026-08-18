import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Player, Score, Song } from '@persistence/entities';
import { CreateScoreDto, UpdateScoreDto } from '../dtos';

@Injectable()
export class ScoreService {
    constructor(
        @InjectRepository(Score)
        private readonly scoreRepository: Repository<Score>,
        @InjectRepository(Song)
        private readonly songRepository: Repository<Song>,
        @InjectRepository(Player)
        private readonly playerRepository: Repository<Player>,
    ) {}

    async create(dto: CreateScoreDto): Promise<Score> {
        const song = await this.songRepository.findOneBy({ id: dto.songId });
        if (!song) throw new NotFoundException(`Song with ID ${dto.songId} not found`);

        const player = await this.playerRepository.findOneBy({ id: dto.playerId });
        if (!player) throw new NotFoundException(`Player with ID ${dto.playerId} not found`);

        const newScore = new Score();
        newScore.percentage = dto.percentage;
        newScore.isFailed = dto.isFailed;
        newScore.song = song;
        newScore.player = player;

        await this.scoreRepository.save(newScore);
        return newScore;
    }

    async update(id: number, dto: UpdateScoreDto): Promise<Score> {
        const existingScore = await this.scoreRepository.findOneBy({ id });
        if (!existingScore) throw new NotFoundException(`Score with ID ${id} not found`);

        if (dto.songId) {
            const song = await this.songRepository.findOneBy({ id: dto.songId });
            if (!song) throw new NotFoundException(`Song with ID ${dto.songId} not found`);
            dto.song = song;
            delete dto.songId;
        }

        if (dto.playerId) {
            const player = await this.playerRepository.findOneBy({ id: dto.playerId });
            if (!player) throw new NotFoundException(`Player with ID ${dto.playerId} not found`);
            dto.player = player;
            delete dto.playerId;
        }

        this.scoreRepository.merge(existingScore, dto);
        return this.scoreRepository.save(existingScore);
    }

    async findBySongId(songId: number): Promise<Score[]> {
        return this.find({ songId });
    }

    async findOne(id: number): Promise<Score | null> {
        return this.scoreRepository.findOne({
            where: { id },
            relations: {
                player: true,
                song: true,
            },
        });
    }

    async find(filters: { songId?: number; playerId?: number }): Promise<Score[]> {
        const where: FindOptionsWhere<Score> = {};
        if (filters.songId !== undefined) {
            where.song = { id: filters.songId };
        }
        if (filters.playerId !== undefined) {
            where.player = { id: filters.playerId };
        }

        return this.scoreRepository.find({
            where,
            relations: {
                player: true,
                song: true,
            },
            order: {
                id: 'DESC',
            },
        });
    }
}
