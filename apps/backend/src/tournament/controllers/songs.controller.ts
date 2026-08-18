import { Body, Controller, Delete, Get, Param, Post, Query, ValidationPipe } from '@nestjs/common';
import { Song } from '@persistence/entities';
import { CreateSongDto } from '../dtos';
import { ScoreService } from '../services/score.service';
import { SongService } from '../services/song.service';
import { TournamentService } from '../services/tournament.service';

@Controller('songs')
export class SongsController {
    constructor(
        private readonly songService: SongService,
        private readonly scoreService: ScoreService,
        private readonly tournamentService: TournamentService,
    ) {}

    @Post()
    async create(@Body(new ValidationPipe()) dto: CreateSongDto): Promise<Song> {
        return await this.songService.create(dto);
    }

    @Get()
    async findAll(@Query('tournamentId') tournamentId: number): Promise<Song[]> {
        return this.tournamentService.findSongsByTournamentId(Number(tournamentId));
    }

    @Get(':id/scores')
    findScores(@Param('id') id: number) {
        return this.scoreService.findBySongId(id);
    }

    @Delete(':id')
    remove(@Param('id') id: number): Promise<void> {
        return this.songService.delete(id);
    }
}
