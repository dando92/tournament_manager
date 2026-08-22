import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, UseGuards, ValidationPipe } from '@nestjs/common';
import { CommitMatchResultResponseDto, CreatedResourceDto, MatchDto } from '@tournament-manager/contracts';
import { RoundSourceDto, CreateMatchWithSongsDto, UpdateMatchActiveDto, UpdateMatchDto } from '@match/match.requests';
import { MatchCommands } from '@match/match.commands';
import { MatchQueries } from '@match/match.queries';
import { ScoringSystemProvider } from '@tournament-manager/scoring';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/guards/tournament-open.guard';

/**
 * Every write here answers `204`. What changed reaches the interface through
 * the event the command published, so a caller reads the match back once
 * instead of being handed a copy in the response and another over the socket.
 *
 * Two routes carry something an event cannot: a creation says where the new
 * match is, and a commit says what start.gg made of the result.
 */
@UseGuards(TournamentOpenGuard)
@Controller('matches')
export class MatchesController {
    constructor(
        private readonly matchCommands: MatchCommands,
        private readonly matchQueries: MatchQueries,
        private readonly scoringSystemProvider: ScoringSystemProvider,
    ) {}

    @Get('scoring-systems')
    getScoringSystem(): string[] {
        return this.scoringSystemProvider.getAll();
    }

    @Post()
    @RequireOpenTournament({ entity: 'phase-group', location: 'body', field: 'phaseGroupId' })
    async create(@Body(new ValidationPipe()) dto: CreateMatchWithSongsDto): Promise<CreatedResourceDto> {
        return { id: await this.matchCommands.create(dto) };
    }

    @Get('division/:divisionId')
    findByDivision(@Param('divisionId') divisionId: number): Promise<MatchDto[]> {
        return this.matchQueries.byDivision(Number(divisionId));
    }

    @Get('phase-group/:phaseGroupId')
    findByPhaseGroup(@Param('phaseGroupId') phaseGroupId: number): Promise<MatchDto[]> {
        return this.matchQueries.byPhaseGroup(Number(phaseGroupId));
    }

    @Get(':id')
    findOne(@Param('id') id: number): Promise<MatchDto | null> {
        return this.matchQueries.byId(Number(id));
    }

    @Patch(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'match', location: 'params', field: 'id' })
    update(@Param('id') id: number, @Body(new ValidationPipe()) dto: UpdateMatchDto): Promise<void> {
        return this.matchCommands.update(Number(id), dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'match', location: 'params', field: 'id' })
    remove(@Param('id') id: number): Promise<void> {
        return this.matchCommands.delete(Number(id));
    }

    @Post(':matchId/rounds')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'match', location: 'params', field: 'matchId' })
    addRound(@Param('matchId') matchId: number, @Body(new ValidationPipe()) dto: RoundSourceDto): Promise<void> {
        return this.matchCommands.addRound(Number(matchId), dto);
    }

    @Put(':matchId/active')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'match', location: 'params', field: 'matchId' })
    updateMatchActive(@Param('matchId') matchId: number, @Body(new ValidationPipe()) dto: UpdateMatchActiveDto): Promise<void> {
        return this.matchCommands.setActive(Number(matchId), dto.active);
    }

    /**
     * The one write that answers with a body. Reporting to start.gg is a
     * best-effort side effect of the commit, and its outcome concerns the person
     * who pressed the button rather than everyone watching the tournament, so it
     * travels back here instead of over the event channel.
     */
    @Put(':matchId/result')
    @RequireOpenTournament({ entity: 'match', location: 'params', field: 'matchId' })
    async commitMatchResult(@Param('matchId') matchId: number): Promise<CommitMatchResultResponseDto> {
        return { startggReport: await this.matchCommands.commitResult(Number(matchId)) };
    }

    @Delete(':matchId/result')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'match', location: 'params', field: 'matchId' })
    reopenMatchResult(@Param('matchId') matchId: number): Promise<void> {
        return this.matchCommands.reopenResult(Number(matchId));
    }
}
