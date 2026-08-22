import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards, ValidationPipe } from '@nestjs/common';
import { CommitMatchResultResponseDto, MatchDto } from '@tournament-manager/contracts';
import { RoundSourceDto, CreateMatchWithSongsDto, UpdateMatchActiveDto, UpdateMatchDto } from '@match/match.requests';
import { MatchCommands } from '@match/match.commands';
import { MatchQueries } from '@match/match.queries';
import { ScoringSystemProvider } from '@tournament-manager/scoring';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/guards/tournament-open.guard';

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
    async create(@Body(new ValidationPipe()) dto: CreateMatchWithSongsDto): Promise<MatchDto | null> {
        const matchId = await this.matchCommands.create(dto);

        return await this.matchQueries.byId(matchId);
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
    @RequireOpenTournament({ entity: 'match', location: 'params', field: 'id' })
    update(@Param('id') id: number, @Body(new ValidationPipe()) dto: UpdateMatchDto): Promise<MatchDto | null> {
        return this.matchCommands.update(Number(id), dto);
    }

    @Delete(':id')
    @RequireOpenTournament({ entity: 'match', location: 'params', field: 'id' })
    remove(@Param('id') id: number): Promise<void> {
        return this.matchCommands.delete(Number(id));
    }

    @Post(':matchId/rounds')
    @RequireOpenTournament({ entity: 'match', location: 'params', field: 'matchId' })
    async addRound(@Param('matchId') matchId: number, @Body(new ValidationPipe()) dto: RoundSourceDto): Promise<MatchDto | null> {
        return await this.matchCommands.addRound(Number(matchId), dto);
    }

    @Put(':matchId/active')
    @RequireOpenTournament({ entity: 'match', location: 'params', field: 'matchId' })
    async updateMatchActive(@Param('matchId') matchId: number, @Body(new ValidationPipe()) dto: UpdateMatchActiveDto): Promise<MatchDto | null> {
        return await this.matchCommands.setActive(Number(matchId), dto.active);
    }

    @Put(':matchId/result')
    @RequireOpenTournament({ entity: 'match', location: 'params', field: 'matchId' })
    async commitMatchResult(@Param('matchId') matchId: number): Promise<CommitMatchResultResponseDto> {
        return await this.matchCommands.commitResult(Number(matchId));
    }

    @Delete(':matchId/result')
    @RequireOpenTournament({ entity: 'match', location: 'params', field: 'matchId' })
    async reopenMatchResult(@Param('matchId') matchId: number): Promise<MatchDto | null> {
        return await this.matchCommands.reopenResult(Number(matchId));
    }
}
