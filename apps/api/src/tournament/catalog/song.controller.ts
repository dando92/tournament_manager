import { Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Post, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { CreatedResourceDto, SongDto, SongImportResultDto, SongRollSlotDto } from '@tournament-manager/contracts';
import { SongCommands } from '@tournament/catalog/song.commands';
import { SongQueries } from '@tournament/catalog/song.queries';
import { SongRoller } from '@tournament/catalog/song-roller';
import { CreateSongDto, ImportSongsDto, RollSongsDto } from '@tournament/catalog/song.requests';
import { DivisionQueries } from '@tournament/structure/division/division.queries';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/shared/tournament-open.guard';

@UseGuards(TournamentOpenGuard)
@Controller('songs')
export class SongsController {
    constructor(
        private readonly songQueries: SongQueries,
        private readonly songCommands: SongCommands,
        private readonly songRoller: SongRoller,
        private readonly divisionQueries: DivisionQueries,
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

    /**
     * The songs a draw would use, without writing any of them.
     *
     * A roll used to happen inside the write that created the rounds, so
     * nobody saw what had been drawn until it already was the match. This
     * answers the same question that write asks — one song per level, over the
     * pool the division may still play — and leaves the writing to the caller,
     * which sends back the identifiers of the draw it kept. It is a `POST`
     * because it carries a body, not because it changes anything.
     *
     * Which tournament's pool is drawn from is read from the division rather
     * than stated by the caller, for the reason FQ-018 records.
     */
    @Post('roll')
    @HttpCode(HttpStatus.OK)
    async roll(@Body(new ValidationPipe({ whitelist: true, transform: true })) dto: RollSongsDto): Promise<SongRollSlotDto[]> {
        const tournamentId = await this.divisionQueries.tournamentIdOf(dto.divisionId);
        if (tournamentId === null) {
            throw new NotFoundException(`Division ${dto.divisionId} not found`);
        }

        return this.songRoller.roll({
            tournamentId,
            divisionId: dto.divisionId,
            group: dto.group ?? null,
            levels: dto.levels,
            allowPlayed: dto.allowPlayed ?? false,
            excludeSongIds: dto.excludeSongIds ?? [],
            matchId: dto.matchId ?? null,
        });
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'song', location: 'params', field: 'id' })
    remove(@Param('id') id: number): Promise<void> {
        return this.songCommands.delete(id);
    }
}
