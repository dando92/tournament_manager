import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { CreatedResourceDto, ParticipantDto, ParticipantImportPreviewRowDto } from '@tournament-manager/contracts';
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
    async createParticipant(
        @Param('id') id: number,
        @Body(new ValidationPipe()) dto: CreateParticipantDto,
    ): Promise<CreatedResourceDto> {
        const participant = await this.tournamentManager.createParticipant(Number(id), dto);

        return { id: participant.id };
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Delete(':id/participants/:participantId')
    @HttpCode(HttpStatus.NO_CONTENT)
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
    async importParticipants(
        @Param('id') id: number,
        @Body(new ValidationPipe()) dto: ImportParticipantsDto,
    ): Promise<CreatedResourceDto[]> {
        const participants = await this.tournamentManager.importParticipants(Number(id), dto.entries);

        return participants.map((participant) => ({ id: participant.id }));
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/participants/:participantId/staff')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'tournament', location: 'params', field: 'id' })
    async addParticipantStaffRole(
        @Param('id') id: number,
        @Param('participantId') participantId: number,
    ): Promise<void> {
        await this.tournamentManager.addParticipantStaffRole(Number(id), Number(participantId));
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Delete(':id/participants/:participantId/staff')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'tournament', location: 'params', field: 'id' })
    async removeParticipantStaffRole(
        @Param('id') id: number,
        @Param('participantId') participantId: number,
    ): Promise<void> {
        await this.tournamentManager.removeParticipantStaffRole(Number(id), Number(participantId));
    }
}
