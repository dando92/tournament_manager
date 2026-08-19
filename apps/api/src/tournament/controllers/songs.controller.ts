import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { Song } from '@tournament-manager/persistence';
import { CreateSongDto } from '../dtos';
import { ScoreService } from '../services/score.service';
import { SongService } from '../services/song.service';
import { TournamentService } from '../services/tournament.service';
import { RequireOpenTournament, TournamentOpenGuard } from '../guards/tournament-open.guard';

@UseGuards(TournamentOpenGuard)
@Controller('songs')
export class SongsController {
    constructor(
        private readonly songService: SongService,
        private readonly scoreService: ScoreService,
        private readonly tournamentService: TournamentService,
    ) {}

    @Post()
    @RequireOpenTournament({ entity: 'tournament', location: 'body', field: 'tournamentId' })
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
    @RequireOpenTournament({ entity: 'song', location: 'params', field: 'id' })
    remove(@Param('id') id: number): Promise<void> {
        return this.songService.delete(id);
    }
}
