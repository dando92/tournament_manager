import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { EntrantDto, PlayerRefDto } from '@tournament-manager/contracts';
import { JwtAuthGuard } from '@auth/guards';
import { PlayerQueries } from '@tournament/catalog/player.queries';
import { BulkAddPlayersToDivisionDto } from '@tournament/catalog/player.requests';
import { ParticipantsCommands } from '@tournament/registration/participants.commands';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/guards/tournament-open.guard';

/**
 * The player catalogue, and the three routes addressed by player rather than by
 * participant.
 *
 * Reading it is the catalogue's own question. Putting somebody in a division is
 * registration's, whatever the route is addressed by: a player has to be a
 * participant of the tournament before a division can admit them, and that rule
 * belongs to the tournament aggregate rather than to the catalogue.
 */
@UseGuards(TournamentOpenGuard)
@Controller('players')
export class PlayersController {
    constructor(
        private readonly players: PlayerQueries,
        private readonly registration: ParticipantsCommands,
    ) {}

    @Get()
    async findAll(): Promise<PlayerRefDto[]> {
        return this.players.all();
    }

    @UseGuards(JwtAuthGuard)
    @Post(':playerId/divisions/:divisionId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'division', location: 'params', field: 'divisionId' })
    async assignToDivision(
        @Param('playerId') playerId: number,
        @Param('divisionId') divisionId: number,
    ): Promise<void> {
        return this.registration.assignPlayerToDivision(Number(playerId), Number(divisionId));
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':playerId/divisions/:divisionId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'division', location: 'params', field: 'divisionId' })
    async removeFromDivision(
        @Param('playerId') playerId: number,
        @Param('divisionId') divisionId: number,
    ): Promise<void> {
        return this.registration.removePlayerFromDivision(Number(playerId), Number(divisionId));
    }

    @UseGuards(JwtAuthGuard)
    @Post('divisions/:divisionId/bulk')
    @RequireOpenTournament({ entity: 'division', location: 'params', field: 'divisionId' })
    async bulkAddToDivision(
        @Param('divisionId') divisionId: number,
        @Body(new ValidationPipe()) dto: BulkAddPlayersToDivisionDto,
    ): Promise<{ entrants: EntrantDto[]; warnings: string[] }> {
        return this.registration.addPlayersToDivision(dto.playerNames, Number(divisionId));
    }
}
