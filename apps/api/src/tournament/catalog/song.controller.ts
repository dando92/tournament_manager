import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { CreatedResourceDto, SongDto } from '@tournament-manager/contracts';
import { SongCommands } from '@tournament/catalog/song.commands';
import { SongQueries } from '@tournament/catalog/song.queries';
import { CreateSongDto } from '@tournament/catalog/song.requests';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/guards/tournament-open.guard';

@UseGuards(TournamentOpenGuard)
@Controller('songs')
export class SongsController {
    constructor(
        private readonly songQueries: SongQueries,
        private readonly songCommands: SongCommands,
    ) {}

    @Post()
    @RequireOpenTournament({ entity: 'tournament', location: 'body', field: 'tournamentId' })
    async create(@Body(new ValidationPipe()) dto: CreateSongDto): Promise<CreatedResourceDto> {
        return { id: await this.songCommands.create(dto) };
    }

    @Get()
    async findAll(@Query('tournamentId') tournamentId: number): Promise<SongDto[]> {
        return this.songQueries.forTournament(Number(tournamentId));
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'song', location: 'params', field: 'id' })
    remove(@Param('id') id: number): Promise<void> {
        return this.songCommands.delete(id);
    }
}
