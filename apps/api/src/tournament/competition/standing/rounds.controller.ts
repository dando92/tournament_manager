import { Body, Controller, Delete, Param, Put, UseGuards, ValidationPipe } from '@nestjs/common';
import { MatchCommands } from '@match/match.commands';
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
 * came from. A round is part of the match aggregate, so its writes are commands
 * on the match.
 */
@UseGuards(TournamentOpenGuard)
@Controller('rounds')
export class RoundsController {
    constructor(private readonly matchCommands: MatchCommands) {}

    @Put(':roundId')
    @RequireOpenTournament({ entity: 'round', location: 'params', field: 'roundId' })
    async replaceSong(
        @Param('roundId') roundId: number,
        @Body(new ValidationPipe()) dto: RoundSourceDto,
    ): Promise<MatchListDto | null> {
        return await this.matchCommands.replaceRoundSong(Number(roundId), dto);
    }

    @Delete(':roundId')
    @RequireOpenTournament({ entity: 'round', location: 'params', field: 'roundId' })
    async removeRound(@Param('roundId') roundId: number): Promise<MatchListDto | null> {
        return await this.matchCommands.removeRound(Number(roundId));
    }

    @Put(':roundId/scores/:playerId')
    @RequireOpenTournament({ entity: 'round', location: 'params', field: 'roundId' })
    async upsertScore(
        @Param('roundId') roundId: number,
        @Param('playerId') playerId: number,
        @Body(new ValidationPipe()) dto: UpsertScoreDto,
    ): Promise<MatchListDto | null> {
        return await this.matchCommands.upsertScore(Number(roundId), Number(playerId), dto);
    }

    @Put(':roundId/points/:playerId')
    @RequireOpenTournament({ entity: 'round', location: 'params', field: 'roundId' })
    async upsertPoints(
        @Param('roundId') roundId: number,
        @Param('playerId') playerId: number,
        @Body(new ValidationPipe()) dto: UpsertPointsDto,
    ): Promise<MatchListDto | null> {
        return await this.matchCommands.upsertPoints(Number(roundId), Number(playerId), dto.points);
    }

    @Delete(':roundId/standings/:playerId')
    @RequireOpenTournament({ entity: 'round', location: 'params', field: 'roundId' })
    async removeStanding(
        @Param('roundId') roundId: number,
        @Param('playerId') playerId: number,
    ): Promise<MatchListDto | null> {
        return await this.matchCommands.removeStanding(Number(roundId), Number(playerId));
    }
}
