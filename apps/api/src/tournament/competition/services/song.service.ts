import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Song, Tournament } from '@tournament-manager/persistence';
import { CreateSongDto } from '@tournament/dtos';

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

    /**
     * The pool of a tournament as entities, for the roller, which attaches one
     * to a round rather than showing it. `SongQueries.forTournament` answers the
     * same question for a reader, and returns DTOs.
     */
    async findByTournament(tournamentId: number): Promise<Song[]> {
        return this.songRepository.find({
            where: { tournament: { id: tournamentId } },
        });
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
