import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { CreatedResourceDto, SongDto, SongImportResultDto } from '@tournament-manager/contracts';
import { SongCommands } from '@tournament/catalog/song.commands';
import { SongQueries } from '@tournament/catalog/song.queries';
import { CreateSongDto, ImportSongsDto } from '@tournament/catalog/song.requests';
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

    /**
     * Everything one folder of simfiles held, in one write.
     *
     * The browser owns the directory the person picked, so it does the reading
     * and the parsing; what arrives here is a list of charts like any other
     * request body, validated row by row and written in one transaction.
     */
    @Post('import')
    @HttpCode(HttpStatus.OK)
    @RequireOpenTournament({ entity: 'tournament', location: 'body', field: 'tournamentId' })
    async import(
        @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: ImportSongsDto,
    ): Promise<SongImportResultDto> {
        return await this.songCommands.import(dto.tournamentId, dto.songs);
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
