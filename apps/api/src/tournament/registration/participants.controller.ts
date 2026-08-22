import { Body, Controller, Delete, Get, Param, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { ParticipantDto, ParticipantImportPreviewRowDto } from '@tournament-manager/contracts';
import { JwtAuthGuard, TournamentAccessGuard } from '@auth/guards';
import {
    CreateParticipantDto,
    ImportParticipantsDto,
    ImportParticipantsPreviewDto,
} from '@tournament/dtos';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/guards/tournament-open.guard';
import { ParticipantQueries } from '@tournament/registration/participants.queries';
import { TournamentManager } from '@tournament/services/tournament.manager';

@UseGuards(TournamentOpenGuard)
@Controller('tournaments')
export class TournamentParticipantsController {
    constructor(
        private readonly participantQueries: ParticipantQueries,
        private readonly tournamentManager: TournamentManager,
    ) {}

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Get(':id/participants')
    listParticipants(@Param('id') id: number): Promise<ParticipantDto[]> {
        return this.participantQueries.forTournament(Number(id));
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/participants')
    @RequireOpenTournament({ entity: 'tournament', location: 'params', field: 'id' })
    createParticipant(
        @Param('id') id: number,
        @Body(new ValidationPipe()) dto: CreateParticipantDto,
    ) {
        return this.tournamentManager.createParticipant(Number(id), dto);
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Delete(':id/participants/:participantId')
    @RequireOpenTournament({ entity: 'tournament', location: 'params', field: 'id' })
    removeParticipant(
        @Param('id') id: number,
        @Param('participantId') participantId: number,
    ): Promise<void> {
        return this.tournamentManager.removeParticipant(Number(id), Number(participantId));
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/participants/import-preview')
    previewParticipantImport(
        @Param('id') id: number,
        @Body(new ValidationPipe()) dto: ImportParticipantsPreviewDto,
    ): Promise<ParticipantImportPreviewRowDto[]> {
        return this.participantQueries.importPreview(Number(id), dto.playerNames);
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/participants/import')
    @RequireOpenTournament({ entity: 'tournament', location: 'params', field: 'id' })
    importParticipants(
        @Param('id') id: number,
        @Body(new ValidationPipe()) dto: ImportParticipantsDto,
    ) {
        return this.tournamentManager.importParticipants(Number(id), dto.entries);
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/participants/:participantId/staff')
    @RequireOpenTournament({ entity: 'tournament', location: 'params', field: 'id' })
    addParticipantStaffRole(
        @Param('id') id: number,
        @Param('participantId') participantId: number,
    ) {
        return this.tournamentManager.addParticipantStaffRole(Number(id), Number(participantId));
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Delete(':id/participants/:participantId/staff')
    @RequireOpenTournament({ entity: 'tournament', location: 'params', field: 'id' })
    removeParticipantStaffRole(
        @Param('id') id: number,
        @Param('participantId') participantId: number,
    ) {
        return this.tournamentManager.removeParticipantStaffRole(Number(id), Number(participantId));
    }
}
