import { Body, Controller, Delete, Get, Param, Patch, Post, Put, ValidationPipe } from '@nestjs/common';
import { MatchListDto } from '@match/dtos/match-list.dto';
import { AddSongToMatchDto, CommitMatchResultDto, CreateMatchDto, CreateMatchWithSongsDto, UpdateMatchActiveDto, UpdateMatchDto } from '@match/dtos/match.dto';
import { Match } from '@persistence/entities';
import { MatchManager } from '@match/services/match.manager';
import { MatchService } from '@match/services/match.service';
import { ScoringSystemProvider } from '@tournament/services/scoring-systems/ScoringSystemProvider';

@Controller('matches')
export class MatchesController {
    constructor(
        private readonly matchService: MatchService,
        private readonly matchManager: MatchManager,
        private readonly scoringSystemProvider: ScoringSystemProvider,
    ) {}

    @Get('scoring-systems')
    getScoringSystem(): string[] {
        return this.scoringSystemProvider.getAll();
    }

    @Post()
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
        return this.matchManager.FindMatchesForDivision(Number(divisionId));
    }

    @Get('phase-group/:phaseGroupId')
    findByPhaseGroup(@Param('phaseGroupId') phaseGroupId: number): Promise<MatchListDto[]> {
        return this.matchManager.FindMatchesForPhaseGroup(Number(phaseGroupId));
    }

    @Get(':id')
    findOne(@Param('id') id: number): Promise<MatchListDto | null> {
        return this.matchManager.GetMatchForView(Number(id));
    }

    @Patch(':id')
    update(@Param('id') id: number, @Body(new ValidationPipe()) dto: UpdateMatchDto): Promise<Match> {
        return this.matchManager.UpdateMatch(Number(id), dto);
    }

    @Delete(':id')
    remove(@Param('id') id: number): Promise<void> {
        return this.matchService.delete(id);
    }

    @Post(':matchId/songs')
    async addSongToMatch(@Param('matchId') matchId: number, @Body(new ValidationPipe()) dto: AddSongToMatchDto): Promise<Match> {
        const match = await this.matchService.getMatch(matchId);

        if (dto.songId) {
            return await this.matchManager.AddSongsToMatch(match, [dto.songId]);
        } else if (dto.level) {
            return await this.matchManager.AddRandomSongsToMatch(match, dto.tournamentId, dto.divisionId, dto.group, dto.level);
        }

        return match;
    }

    @Delete(':matchId/songs/:songId')
    async removeSongFromMatch(@Param('matchId') matchId: number, @Param('songId') songId: number): Promise<Match> {
        await this.matchManager.RemoveSongFromMatchById(matchId, songId);
        return await this.matchService.getMatch(matchId);
    }

    @Put(':matchId/songs/:songId')
    async editSongInMatch(@Param('matchId') matchId: number, @Param('songId') songId: number, @Body(new ValidationPipe()) dto: AddSongToMatchDto): Promise<Match> {
        await this.matchManager.RemoveSongFromMatchById(matchId, songId);
        const match = await this.matchService.getMatch(matchId);

        if (dto.songId) {
            return await this.matchManager.AddSongsToMatch(match, [dto.songId]);
        } else if (dto.level) {
            return await this.matchManager.AddRandomSongsToMatch(match, dto.tournamentId, dto.divisionId, dto.group, dto.level);
        }

        return match;
    }

    @Put(':matchId/active')
    async updateMatchActive(@Param('matchId') matchId: number, @Body(new ValidationPipe()) dto: UpdateMatchActiveDto): Promise<MatchListDto | null> {
        return await this.matchManager.UpdateMatchActive(Number(matchId), dto);
    }

    @Put(':matchId/result')
    async commitMatchResult(@Param('matchId') matchId: number, @Body(new ValidationPipe()) dto: CommitMatchResultDto): Promise<MatchListDto | null> {
        return await this.matchManager.CommitMatchResult(Number(matchId), dto);
    }

    @Delete(':matchId/result')
    async reopenMatchResult(@Param('matchId') matchId: number): Promise<MatchListDto | null> {
        return await this.matchManager.ReopenMatchResult(Number(matchId));
    }
}
