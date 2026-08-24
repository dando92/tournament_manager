import { Body, Controller, Delete, Headers, HttpCode, HttpStatus, Param, Put, UseGuards, ValidationPipe } from '@nestjs/common';
import { MatchCommands } from '@match/match.commands';
import { UpsertPointsDto, UpsertScoreDto } from '@match/rounds.requests';
import { RoundSourceDto } from '@match/match.requests';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/shared/tournament-open.guard';

/**
 * A round is the unit a match is scored in, and here it is a resource.
 *
 * Addressing a standing by its round rather than by its song is what makes a
 * hand-scored round reachable at all: it has no song to name. The two write
 * routes carry the two kinds of evidence and each refuses the other; both end
 * in the same row.
 *
 * Every route answers `204`. A round is part of the match aggregate, so its
 * writes are commands on the match, and the changed match reaches the interface
 * through the event the command publishes rather than through this response.
 */
@UseGuards(TournamentOpenGuard)
@Controller('rounds')
export class RoundsController {
    constructor(private readonly matchCommands: MatchCommands) {}

    @Put(':roundId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'round', location: 'params', field: 'roundId' })
    replaceSong(
        @Param('roundId') roundId: number,
        @Body(new ValidationPipe()) dto: RoundSourceDto,
        @Headers('x-confirm-control-room-stop') confirmation?: string,
    ): Promise<void> {
        return this.matchCommands.replaceRoundSong(Number(roundId), dto, confirmation === 'true');
    }

    @Delete(':roundId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'round', location: 'params', field: 'roundId' })
    removeRound(@Param('roundId') roundId: number, @Headers('x-confirm-control-room-stop') confirmation?: string): Promise<void> {
        return this.matchCommands.removeRound(Number(roundId), confirmation === 'true');
    }

    @Put(':roundId/scores/:playerId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'round', location: 'params', field: 'roundId' })
    upsertScore(
        @Param('roundId') roundId: number,
        @Param('playerId') playerId: number,
        @Body(new ValidationPipe()) dto: UpsertScoreDto,
    ): Promise<void> {
        return this.matchCommands.upsertScore(Number(roundId), Number(playerId), dto);
    }

    @Put(':roundId/points/:playerId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'round', location: 'params', field: 'roundId' })
    upsertPoints(
        @Param('roundId') roundId: number,
        @Param('playerId') playerId: number,
        @Body(new ValidationPipe()) dto: UpsertPointsDto,
        @Headers('x-confirm-control-room-stop') confirmation?: string,
    ): Promise<void> {
        return this.matchCommands.upsertPoints(Number(roundId), Number(playerId), dto.points, confirmation === 'true');
    }

    @Delete(':roundId/standings/:playerId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'round', location: 'params', field: 'roundId' })
    removeStanding(
        @Param('roundId') roundId: number,
        @Param('playerId') playerId: number,
        @Headers('x-confirm-control-room-stop') confirmation?: string,
    ): Promise<void> {
        return this.matchCommands.removeStanding(Number(roundId), Number(playerId), confirmation === 'true');
    }
}
