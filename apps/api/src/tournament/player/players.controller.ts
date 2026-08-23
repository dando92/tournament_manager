import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { Player } from '@tournament-manager/persistence';
import { EntrantDto } from '@tournament-manager/contracts';
import { JwtAuthGuard } from '@auth/guards';
import { PlayerService } from '@player/player.service';
import { ParticipantsCommands } from '@tournament/registration/participants.commands';
import { BulkAddPlayersToDivisionDto } from '@player/player.dto';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/guards/tournament-open.guard';

@UseGuards(TournamentOpenGuard)
@Controller('players')
export class PlayersController {
    constructor(
        private readonly playerService: PlayerService,
        private readonly registration: ParticipantsCommands,
    ) {}

    @Get()
    async findAll(): Promise<Player[]> {
        return this.playerService.findAll();
    }

    @UseGuards(JwtAuthGuard)
    @Post(':playerId/divisions/:divisionId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'division', location: 'params', field: 'divisionId' })
    async assignToDivision(
        @Param('playerId') playerId: number,
        @Param('divisionId') divisionId: number,
    ): Promise<void> {
        return this.registration.assignPlayerToDivision(playerId, divisionId);
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':playerId/divisions/:divisionId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'division', location: 'params', field: 'divisionId' })
    async removeFromDivision(
        @Param('playerId') playerId: number,
        @Param('divisionId') divisionId: number,
    ): Promise<void> {
        return this.registration.removePlayerFromDivision(playerId, divisionId);
    }

    @UseGuards(JwtAuthGuard)
    @Post('divisions/:divisionId/bulk')
    @RequireOpenTournament({ entity: 'division', location: 'params', field: 'divisionId' })
    async bulkAddToDivision(
        @Param('divisionId') divisionId: number,
        @Body(new ValidationPipe()) dto: BulkAddPlayersToDivisionDto,
    ): Promise<{ entrants: EntrantDto[]; warnings: string[] }> {
        return this.registration.addPlayersToDivision(dto.playerNames, divisionId);
    }
}
