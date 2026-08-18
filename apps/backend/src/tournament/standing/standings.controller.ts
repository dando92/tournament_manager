import { Body, Controller, Delete, Param, Post, Put } from '@nestjs/common';
import { AddStandingToMatchDto, CreateScoreDto } from '../dtos';
import { Match } from '@persistence/entities';
import { StandingManager } from './standing.manager';

@Controller('standings')
export class StandingsController {
    constructor(
        private readonly standingManager: StandingManager,
    ) {}

    @Post('matches/:matchId')
    async addStanding(@Param('matchId') matchId: number, @Body() dto: AddStandingToMatchDto): Promise<Match> {
        const score = new CreateScoreDto();
        score.isFailed = dto.isFailed;
        score.percentage = dto.percentage;
        score.playerId = dto.playerId;
        score.songId = dto.songId;

        return await this.standingManager.AddScoreToMatchById(matchId, score, dto.scoreId);
    }

    @Delete('matches/:matchId/:playerId/:songId')
    async deleteStanding(
        @Param('matchId') matchId: number,
        @Param('playerId') playerId: number,
        @Param('songId') songId: number,
    ): Promise<Match> {
        return await this.standingManager.RemoveStandingFromMatch(matchId, playerId, songId);
    }

    @Put('matches/:matchId')
    async editStanding(@Param('matchId') matchId: number, @Body() dto: AddStandingToMatchDto): Promise<Match> {
        return await this.standingManager.EditStandingInMatch(
            matchId,
            dto.playerId,
            dto.songId,
            dto.percentage,
            dto.isFailed,
            dto.scoreId,
        );
    }
}
