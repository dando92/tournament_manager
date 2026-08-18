import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Song, Tournament } from '@persistence/entities';
import { CreateSongDto } from '../dtos';

@Injectable()
export class SongService {
    constructor(
        @InjectRepository(Song)
        private readonly songRepository: Repository<Song>,
        @InjectRepository(Tournament)
        private readonly tournamentRepository: Repository<Tournament>,
    ) {}

    async create(dto: CreateSongDto): Promise<Song> {
        const song = this.songRepository.create(dto);
        song.title = dto.title;
        song.group = dto.group;
        song.difficulty = dto.difficulty;

        if (dto.tournamentId) {
            const tournament = await this.tournamentRepository.findOneBy({ id: dto.tournamentId });
            if (!tournament) {
                throw new NotFoundException(`Tournament ${dto.tournamentId} not found`);
            }
            song.tournament = tournament;
        }

        return this.songRepository.save(song);
    }

    async delete(id: number): Promise<void> {
        await this.songRepository.delete(id);
    }

    async findByTitleAndTournament(title: string, tournamentId: number): Promise<Song | null> {
        return this.songRepository.findOne({
            where: {
                title,
                tournament: {
                    id: tournamentId,
                },
            },
        });
    }
}
