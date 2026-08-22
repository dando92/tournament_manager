import { Body, Controller, Delete, Param, Put, UseGuards, ValidationPipe } from '@nestjs/common';
import { StandingManager } from './standing.manager';
import { MatchManager } from '@match/services/match.manager';
import { MatchListDto } from '@match/dtos/match-list.dto';
import { UpsertPointsDto, UpsertScoreDto } from './standing.dto';
import { RoundSourceDto } from '@match/dtos/match.dto';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/guards/tournament-open.guard';

/**
 * A round is the unit a match is scored in, and here it is a resource.
 *
 * Addressing a standing by its round rather than by its song is what makes a
 * hand-scored round reachable at all: it has no song to name. The two write
 * routes carry the two kinds of evidence and each refuses the other; both end
 * in the same row.
 *
 * Every route answers with the whole match in the shape every other match
 * endpoint uses, so a client can apply one response the same way wherever it
 * came from.
 */
@UseGuards(TournamentOpenGuard)
@Controller('rounds')
export class RoundsController {
    constructor(
        private readonly standingManager: StandingManager,
        private readonly matchManager: MatchManager,
    ) {}

    @Put(':roundId')
    @RequireOpenTournament({ entity: 'round', location: 'params', field: 'roundId' })
    async replaceSong(
        @Param('roundId') roundId: number,
        @Body(new ValidationPipe()) dto: RoundSourceDto,
    ): Promise<MatchListDto | null> {
        return await this.matchManager.ReplaceRoundSong(Number(roundId), dto);
    }

    @Delete(':roundId')
    @RequireOpenTournament({ entity: 'round', location: 'params', field: 'roundId' })
    async removeRound(@Param('roundId') roundId: number): Promise<MatchListDto | null> {
        return await this.matchManager.RemoveRound(Number(roundId));
    }

    @Put(':roundId/scores/:playerId')
    @RequireOpenTournament({ entity: 'round', location: 'params', field: 'roundId' })
    async upsertScore(
        @Param('roundId') roundId: number,
        @Param('playerId') playerId: number,
        @Body(new ValidationPipe()) dto: UpsertScoreDto,
    ): Promise<MatchListDto | null> {
        const match = await this.standingManager.upsertScore(Number(roundId), Number(playerId), dto);
        return await this.matchManager.GetMatchForView(match.id);
    }

    @Put(':roundId/points/:playerId')
    @RequireOpenTournament({ entity: 'round', location: 'params', field: 'roundId' })
    async upsertPoints(
        @Param('roundId') roundId: number,
        @Param('playerId') playerId: number,
        @Body(new ValidationPipe()) dto: UpsertPointsDto,
    ): Promise<MatchListDto | null> {
        const match = await this.standingManager.upsertPoints(Number(roundId), Number(playerId), dto.points);
        return await this.matchManager.GetMatchForView(match.id);
    }

    @Delete(':roundId/standings/:playerId')
    @RequireOpenTournament({ entity: 'round', location: 'params', field: 'roundId' })
    async removeStanding(
        @Param('roundId') roundId: number,
        @Param('playerId') playerId: number,
    ): Promise<MatchListDto | null> {
        const match = await this.standingManager.removeStanding(Number(roundId), Number(playerId));
        return await this.matchManager.GetMatchForView(match.id);
    }
}
