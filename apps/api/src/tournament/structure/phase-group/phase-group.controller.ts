import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { CreatedResourceDto, PhaseGroupEntrantDto } from '@tournament-manager/contracts';
import { CreatePhaseGroupDto, UpdatePhaseGroupDto } from '@tournament/dtos';
import { PhaseGroupManager } from '@tournament/structure/phase-group/phase-group.manager';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/guards/tournament-open.guard';

@UseGuards(TournamentOpenGuard)
@Controller()
export class PhaseGroupsController {
    constructor(private readonly phaseGroupManager: PhaseGroupManager) {}

    @Post('phases/:phaseId/phase-groups')
    @RequireOpenTournament({ entity: 'phase', location: 'params', field: 'phaseId' })
    async createForPhase(
        @Param('phaseId') phaseId: number,
        @Body(new ValidationPipe()) dto: CreatePhaseGroupDto,
    ): Promise<CreatedResourceDto> {
        const phaseGroup = await this.phaseGroupManager.createForPhase(Number(phaseId), dto);

        return { id: phaseGroup.id };
    }

    @Get('phase-groups/:id/entrants')
    async getEntrants(@Param('id') id: number): Promise<PhaseGroupEntrantDto[]> {
        return this.phaseGroupManager.getEntrants(Number(id));
    }

    @Patch('phase-groups/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'phase-group', location: 'params', field: 'id' })
    async update(
        @Param('id') id: number,
        @Body(new ValidationPipe()) dto: UpdatePhaseGroupDto,
    ): Promise<void> {
        await this.phaseGroupManager.update(Number(id), dto);
    }

    @Delete('phase-groups/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'phase-group', location: 'params', field: 'id' })
    async delete(@Param('id') id: number): Promise<void> {
        return this.phaseGroupManager.delete(Number(id));
    }

}
