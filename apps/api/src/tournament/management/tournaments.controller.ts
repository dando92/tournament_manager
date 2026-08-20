import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards, ValidationPipe } from '@nestjs/common';
import { Tournament } from '@tournament-manager/persistence';
import {
    CreateTournamentDto,
    UpdateTournamentDto,
    TournamentOverviewDto,
    TournamentResponseDto,
    TournamentConfigurationDto,
} from '@tournament/dtos';
import { JwtAuthGuard, CreatorOrAdminGuard, TournamentAccessGuard } from '@auth/guards';
import { AuthService } from '@auth/services/auth.service';
import { MyTournamentRoles, TournamentService } from '@tournament/services/tournament.service';
import { TournamentManager } from '@tournament/services/tournament.manager';
import { TournamentSyncStartService } from '@tournament/syncstart/tournament-syncstart.service';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/guards/tournament-open.guard';

@UseGuards(TournamentOpenGuard)
@Controller('tournaments')
export class TournamentsController {
    constructor(
        private readonly authService: AuthService,
        private readonly tournamentService: TournamentService,
        private readonly tournamentManager: TournamentManager,
        private readonly syncStart: TournamentSyncStartService,
    ) {}

    @UseGuards(JwtAuthGuard, CreatorOrAdminGuard)
    @Post()
    async create(@Body(new ValidationPipe()) dto: CreateTournamentDto, @Request() req): Promise<TournamentResponseDto> {
        const tournament = await this.tournamentManager.create(dto, req.user?.id);
        if (dto.syncstartUrl) {
            await this.syncStart.configureTournament(tournament.id, dto.syncstartUrl);
        }
        return tournament;
    }

    @Get('public')
    findAllPublic(): Promise<Tournament[]> {
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
    findOne(@Param('id') id: number): Promise<TournamentResponseDto | null> {
        return this.tournamentManager.findOne(Number(id));
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Patch(':id')
    @RequireOpenTournament({ entity: 'tournament', location: 'params', field: 'id' })
    async update(@Param('id') id: number, @Body(new ValidationPipe()) dto: UpdateTournamentDto): Promise<TournamentResponseDto> {
        const { tournament, previousSyncstartUrl } = await this.tournamentManager.update(Number(id), dto);
        if (dto.syncstartUrl !== undefined && dto.syncstartUrl !== previousSyncstartUrl) {
            await this.syncStart.configureTournament(Number(id), dto.syncstartUrl);
        }
        return tournament;
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/close')
    async close(@Param('id') id: number): Promise<TournamentResponseDto> {
        const tournament = await this.tournamentManager.close(Number(id));
        await this.syncStart.closeTournament(Number(id));
        return tournament;
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/reopen')
    async reopen(@Param('id') id: number): Promise<TournamentResponseDto> {
        const tournament = await this.tournamentManager.reopen(Number(id));
        await this.syncStart.configureTournament(Number(id), tournament.syncstartUrl ?? '');
        return tournament;
    }
}
