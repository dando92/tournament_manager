import { Body, Controller, Get, Param, Patch, Post, Delete, Request, UseGuards, ValidationPipe } from '@nestjs/common';
import { Tournament } from '@persistence/entities';
import {
    CreateParticipantDto,
    CreateTournamentDto,
    ImportParticipantsDto,
    ImportParticipantsPreviewDto,
    UpdateTournamentDto,
    TournamentOverviewDto,
    TournamentResponseDto,
    TournamentConfigurationDto,
} from '../dtos';
import { JwtAuthGuard, CreatorOrAdminGuard, TournamentAccessGuard } from '@auth/guards';
import { AuthService } from '@auth/services/auth.service';
import { MyTournamentRoles, TournamentService } from '../services/tournament.service';
import { TournamentManager } from '../services/tournament.manager';
import { LobbyManager } from '../services/lobby-manager.service';
import { StartggService } from '../../integrations/startgg/startgg.service';
import { StartggImportPreviewDto } from '../../integrations/startgg/startgg.dto';

@Controller('tournaments')
export class TournamentsController {
    constructor(
        private readonly authService: AuthService,
        private readonly tournamentService: TournamentService,
        private readonly tournamentManager: TournamentManager,
        private readonly lobbyManager: LobbyManager,
        private readonly startggService: StartggService,
    ) {}

    @UseGuards(JwtAuthGuard, CreatorOrAdminGuard)
    @Post()
    async create(@Body(new ValidationPipe()) dto: CreateTournamentDto, @Request() req): Promise<TournamentResponseDto> {
        const tournament = await this.tournamentManager.create(dto, req.user?.id);
        if (dto.syncstartUrl) {
            this.lobbyManager.OnTournamentCreated(tournament.id, dto.syncstartUrl);
        }
        return tournament;
    }

    @Get('public')
    async findAllPublic(): Promise<Tournament[]> {
        return this.tournamentService.findAllPublic();
    }

    @UseGuards(JwtAuthGuard)
    @Get('my-roles')
    async getMyRoles(@Request() req): Promise<MyTournamentRoles> {
        const roles = await this.tournamentService.getMyRoles(req.user.id);
        const permissions = await this.authService.getPermissions(req.user.id);
        return {
            ...roles,
            isAdmin: permissions.isAdmin,
            canCreateTournament: permissions.isAdmin || permissions.isTournamentCreator,
        };
    }

    @Get(':id/overview')
    findOverview(@Param('id') id: number): Promise<TournamentOverviewDto> {
        return this.tournamentManager.findOverview(Number(id));
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Get(':id/configuration')
    findConfiguration(@Param('id') id: number): Promise<TournamentConfigurationDto> {
        return this.tournamentManager.findConfiguration(Number(id));
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Get(':id/startgg/api-key-status')
    getStartggApiKeyStatus(@Param('id') id: number): Promise<{ hasStartggApiKey: boolean }> {
        return this.tournamentManager.hasStartggApiKey(Number(id));
    }

    @Get(':id')
    async findOne(@Param('id') id: number): Promise<TournamentResponseDto | null> {
        return this.tournamentManager.findOne(Number(id));
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Patch(':id')
    async update(@Param('id') id: number, @Body(new ValidationPipe()) dto: UpdateTournamentDto): Promise<TournamentResponseDto> {
        const { tournament, previousSyncstartUrl } = await this.tournamentManager.update(Number(id), dto);
        if (dto.syncstartUrl !== undefined && dto.syncstartUrl !== previousSyncstartUrl) {
            this.lobbyManager.OnTournamentUrlChanged(Number(id), dto.syncstartUrl);
        }
        return tournament;
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Get(':id/participants')
    async listParticipants(@Param('id') id: number) {
        return this.tournamentManager.listParticipants(Number(id));
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/participants')
    async createParticipant(
        @Param('id') id: number,
        @Body(new ValidationPipe()) dto: CreateParticipantDto,
    ) {
        return this.tournamentManager.createParticipant(Number(id), dto);
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Delete(':id/participants/:participantId')
    async removeParticipant(
        @Param('id') id: number,
        @Param('participantId') participantId: number,
    ): Promise<void> {
        return this.tournamentManager.removeParticipant(Number(id), Number(participantId));
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/participants/import-preview')
    async previewParticipantImport(
        @Param('id') id: number,
        @Body(new ValidationPipe()) dto: ImportParticipantsPreviewDto,
    ) {
        return this.tournamentManager.previewParticipantImport(Number(id), dto.playerNames);
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/participants/import')
    async importParticipants(
        @Param('id') id: number,
        @Body(new ValidationPipe()) dto: ImportParticipantsDto,
    ) {
        return this.tournamentManager.importParticipants(Number(id), dto.entries);
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/startgg/import-preview')
    async previewStartggImport(
        @Param('id') id: number,
        @Body(new ValidationPipe()) dto: StartggImportPreviewDto,
        @Request() req,
    ) {
        return this.startggService.previewImport({
            ...dto,
            targetTournamentId: Number(id),
        }, req.user);
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/startgg/import')
    async importStartggEvent(
        @Param('id') id: number,
        @Body(new ValidationPipe()) dto: StartggImportPreviewDto,
        @Request() req,
    ) {
        return this.startggService.importEvent({
            ...dto,
            targetTournamentId: Number(id),
        }, req.user);
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/participants/:participantId/staff')
    async addParticipantStaffRole(
        @Param('id') id: number,
        @Param('participantId') participantId: number,
    ) {
        return this.tournamentManager.addParticipantStaffRole(Number(id), Number(participantId));
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Delete(':id/participants/:participantId/staff')
    async removeParticipantStaffRole(
        @Param('id') id: number,
        @Param('participantId') participantId: number,
    ) {
        return this.tournamentManager.removeParticipantStaffRole(Number(id), Number(participantId));
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Get(':id/lobbies')
    async getLobbies(@Param('id') id: number) {
        return this.lobbyManager.GetLobbies(Number(id));
    }

    @Get(':id/lobbies/status')
    async getLobbiesStatus(@Param('id') id: number) {
        return this.lobbyManager.GetLobbies(Number(id));
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/lobbies/server/connect')
    async connectSyncStartServer(@Param('id') id: number) {
        return this.lobbyManager.ConnectSyncStartServer(Number(id));
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Delete(':id/lobbies/server/disconnect')
    disconnectSyncStartServer(@Param('id') id: number) {
        return this.lobbyManager.DisconnectSyncStartServer(Number(id));
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/lobbies/connect')
    async connectLobby(
        @Param('id') id: number,
        @Body() body: { name?: string; lobbyCode: string; password?: string },
    ) {
        const lobbyId = await this.lobbyManager.ConnectLobby(Number(id), body.name || body.lobbyCode, body.lobbyCode, body.password ?? '');
        return { id: lobbyId };
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/lobbies/create')
    async createLobby(
        @Param('id') id: number,
        @Body() body: { name?: string; password?: string },
    ) {
        return this.lobbyManager.CreateLobby(Number(id), body.name ?? '', body.password ?? '');
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Delete(':id/lobbies/:lobbyId/disconnect')
    disconnectLobby(@Param('id') id: number, @Param('lobbyId') lobbyId: string) {
        this.lobbyManager.DisconnectLobby(Number(id), lobbyId);
        return { ok: true };
    }
}
