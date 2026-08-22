import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match, Round, Song } from '@tournament-manager/persistence';
import { CreateRoundDto, UpdateRoundDto } from '@tournament/dtos';

/**
 * Rounds: the units a match is scored in.
 *
 * A round is created with a song when a song is added to the match, and without
 * one when the match is scored by hand. The database allows one hand-scored
 * round per match and refuses the same song twice, so both rules fail here as
 * constraint violations rather than passing silently.
 */
@Injectable()
export class RoundService {
    constructor(
        @InjectRepository(Round)
        private readonly roundsRepo: Repository<Round>,
        @InjectRepository(Match)
        private readonly matchRepo: Repository<Match>,
        @InjectRepository(Song)
        private readonly songRepo: Repository<Song>,
    ) {}

    async create(dto: CreateRoundDto): Promise<Round> {
        const match = await this.matchRepo.findOneBy({ id: dto.matchId });
        if (!match) throw new NotFoundException(`Match with id ${dto.matchId} not found. Insert round failed`);

        const newRound = new Round();
        newRound.standings = [];
        newRound.matchAssignments = [];
        newRound.match = match;
        newRound.song = null;

        if (dto.songId !== undefined && dto.songId !== null) {
            const song = await this.songRepo.findOneBy({ id: dto.songId });
            if (!song) throw new NotFoundException(`Song with id ${dto.songId} not found. Insert round failed`);
            newRound.song = song;
        }

        await this.roundsRepo.save(newRound);
        return newRound;
    }

    async findOneWithMatch(id: number): Promise<Round | null> {
        return this.roundsRepo.findOne({
            where: { id },
            relations: { match: true, song: true },
        });
    }

    async update(id: number, dto: UpdateRoundDto): Promise<Round> {
        const round = await this.roundsRepo.findOneBy({ id });
        if (!round) throw new NotFoundException(`Round with id ${id} not found. Update round failed`);

        if (dto.matchId) {
            const match = await this.matchRepo.findOneBy({ id: dto.matchId });
            if (!match) throw new NotFoundException(`Match with id ${dto.matchId} not found. Update round failed`);
            dto.match = match;
            delete dto.matchId;
        }

        if (dto.songId) {
            const song = await this.songRepo.findOneBy({ id: dto.songId });
            if (!song) throw new NotFoundException(`Song with id ${dto.songId} not found. Update round failed`);
            dto.song = song;
            delete dto.songId;
        }

        this.roundsRepo.merge(round, dto);
        return this.roundsRepo.save(round);
    }

    async delete(id: number): Promise<void> {
        await this.roundsRepo.delete(id);
    }
}
