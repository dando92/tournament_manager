import { Body, Controller, Delete, Get, Param, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { Entrant, Player } from '@tournament-manager/persistence';
import { JwtAuthGuard } from '@auth/guards';
import { PlayerService } from '@player/player.service';
import { PlayerManager } from '@player/player.manager';
import { BulkAddPlayersToDivisionDto } from '@player/player.dto';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/guards/tournament-open.guard';

@UseGuards(TournamentOpenGuard)
@Controller('players')
export class PlayersController {
    constructor(
        private readonly playerService: PlayerService,
        private readonly playerManager: PlayerManager,
    ) {}

    @Get()
    async findAll(): Promise<Player[]> {
        return this.playerService.findAll();
    }

    @UseGuards(JwtAuthGuard)
    @Post(':playerId/divisions/:divisionId')
    @RequireOpenTournament({ entity: 'division', location: 'params', field: 'divisionId' })
    async assignToDivision(
        @Param('playerId') playerId: number,
        @Param('divisionId') divisionId: number,
    ): Promise<void> {
        return this.playerManager.assignPlayerToDivision(playerId, divisionId);
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':playerId/divisions/:divisionId')
    @RequireOpenTournament({ entity: 'division', location: 'params', field: 'divisionId' })
    async removeFromDivision(
        @Param('playerId') playerId: number,
        @Param('divisionId') divisionId: number,
    ): Promise<void> {
        return this.playerManager.removePlayerFromDivision(playerId, divisionId);
    }

    @UseGuards(JwtAuthGuard)
    @Post('divisions/:divisionId/bulk')
    @RequireOpenTournament({ entity: 'division', location: 'params', field: 'divisionId' })
    async bulkAddToDivision(
        @Param('divisionId') divisionId: number,
        @Body(new ValidationPipe()) dto: BulkAddPlayersToDivisionDto,
    ): Promise<{ entrants: Entrant[]; warnings: string[] }> {
        return this.playerManager.addPlayersToDivision(dto.playerNames, divisionId);
    }
}
