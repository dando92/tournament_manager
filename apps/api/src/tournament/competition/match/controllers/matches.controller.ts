import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards, ValidationPipe } from '@nestjs/common';
import { MatchListDto } from '@match/dtos/match-list.dto';
import { RoundSourceDto, CommitMatchResultResponseDto, CreateMatchDto, CreateMatchWithSongsDto, UpdateMatchActiveDto, UpdateMatchDto } from '@match/dtos/match.dto';
import { Match } from '@tournament-manager/persistence';
import { MatchManager } from '@match/services/match.manager';
import { MatchQueries } from '@match/match.queries';
import { MatchService } from '@match/services/match.service';
import { ScoringSystemProvider } from '@tournament-manager/scoring';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/guards/tournament-open.guard';

@UseGuards(TournamentOpenGuard)
@Controller('matches')
export class MatchesController {
    constructor(
        private readonly matchService: MatchService,
        private readonly matchManager: MatchManager,
        private readonly matchQueries: MatchQueries,
        private readonly scoringSystemProvider: ScoringSystemProvider,
    ) {}

    @Get('scoring-systems')
    getScoringSystem(): string[] {
        return this.scoringSystemProvider.getAll();
    }

    @Post()
    @RequireOpenTournament({ entity: 'phase-group', location: 'body', field: 'phaseGroupId' })
    async create(@Body(new ValidationPipe()) dto: CreateMatchWithSongsDto): Promise<Match> {
        const createMatchDto: CreateMatchDto = {
            name: dto.name,
            subtitle: dto.subtitle,
            notes: dto.notes,
            entrantIds: dto.entrantIds,
            phaseGroupId: dto.phaseGroupId,
            scoringSystem: dto.scoringSystem,
        };
        const match = await this.matchService.create(createMatchDto);

        if (dto.songIds) {
            return await this.matchManager.AddSongsToMatch(match, dto.songIds);
        } else if (dto.levels) {
            return await this.matchManager.AddRandomSongsToMatch(match, dto.tournamentId, dto.divisionId, dto.group, dto.levels);
        }

        return match;
    }

    @Get('division/:divisionId')
    findByDivision(@Param('divisionId') divisionId: number): Promise<MatchListDto[]> {
        return this.matchQueries.byDivision(Number(divisionId));
    }

    @Get('phase-group/:phaseGroupId')
    findByPhaseGroup(@Param('phaseGroupId') phaseGroupId: number): Promise<MatchListDto[]> {
        return this.matchQueries.byPhaseGroup(Number(phaseGroupId));
    }

    @Get(':id')
    findOne(@Param('id') id: number): Promise<MatchListDto | null> {
        return this.matchQueries.byId(Number(id));
    }

    @Patch(':id')
    @RequireOpenTournament({ entity: 'match', location: 'params', field: 'id' })
    update(@Param('id') id: number, @Body(new ValidationPipe()) dto: UpdateMatchDto): Promise<Match> {
        return this.matchManager.UpdateMatch(Number(id), dto);
    }

    @Delete(':id')
    @RequireOpenTournament({ entity: 'match', location: 'params', field: 'id' })
    remove(@Param('id') id: number): Promise<void> {
        return this.matchService.delete(id);
    }

    @Post(':matchId/rounds')
    @RequireOpenTournament({ entity: 'match', location: 'params', field: 'matchId' })
    async addRound(@Param('matchId') matchId: number, @Body(new ValidationPipe()) dto: RoundSourceDto): Promise<MatchListDto | null> {
        return await this.matchManager.AddRound(Number(matchId), dto);
    }

    @Put(':matchId/active')
    @RequireOpenTournament({ entity: 'match', location: 'params', field: 'matchId' })
    async updateMatchActive(@Param('matchId') matchId: number, @Body(new ValidationPipe()) dto: UpdateMatchActiveDto): Promise<MatchListDto | null> {
        return await this.matchManager.UpdateMatchActive(Number(matchId), dto);
    }

    @Put(':matchId/result')
    @RequireOpenTournament({ entity: 'match', location: 'params', field: 'matchId' })
    async commitMatchResult(@Param('matchId') matchId: number): Promise<CommitMatchResultResponseDto> {
        return await this.matchManager.CommitMatchResult(Number(matchId));
    }

    @Delete(':matchId/result')
    @RequireOpenTournament({ entity: 'match', location: 'params', field: 'matchId' })
    async reopenMatchResult(@Param('matchId') matchId: number): Promise<MatchListDto | null> {
        return await this.matchManager.ReopenMatchResult(Number(matchId));
    }
}
