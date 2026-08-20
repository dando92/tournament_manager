import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import {
    CreatePhaseGroupDto,
    UpdatePhaseGroupDto,
    UpdatePhaseGroupSeedingDto,
} from '@tournament/dtos';
import { DivisionSummaryPhaseGroupDto } from '@tournament/structure/dtos/division-summary.dto';
import { PhaseGroupManager } from '@tournament/structure/services/phase-group.manager';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/guards/tournament-open.guard';

@UseGuards(TournamentOpenGuard)
@Controller()
export class PhaseGroupsController {
    constructor(private readonly phaseGroupManager: PhaseGroupManager) {}

    @Get('phases/:phaseId/phase-groups')
    async findByPhase(@Param('phaseId') phaseId: number): Promise<DivisionSummaryPhaseGroupDto[]> {
        return this.phaseGroupManager.findByPhase(Number(phaseId));
    }

    @Post('phases/:phaseId/phase-groups')
    @RequireOpenTournament({ entity: 'phase', location: 'params', field: 'phaseId' })
    async createForPhase(
        @Param('phaseId') phaseId: number,
        @Body(new ValidationPipe()) dto: CreatePhaseGroupDto,
    ): Promise<DivisionSummaryPhaseGroupDto> {
        return this.phaseGroupManager.createForPhase(Number(phaseId), dto);
    }

    @Get('phase-groups/:id')
    async findOne(@Param('id') id: number): Promise<DivisionSummaryPhaseGroupDto> {
        return this.phaseGroupManager.findOne(Number(id));
    }

    @Get('phase-groups/:id/entrants')
    async getEntrants(@Param('id') id: number): Promise<DivisionSummaryPhaseGroupDto['entrants']> {
        return this.phaseGroupManager.getEntrants(Number(id));
    }

    @Patch('phase-groups/:id')
    @RequireOpenTournament({ entity: 'phase-group', location: 'params', field: 'id' })
    async update(
        @Param('id') id: number,
        @Body(new ValidationPipe()) dto: UpdatePhaseGroupDto,
    ): Promise<DivisionSummaryPhaseGroupDto> {
        return this.phaseGroupManager.update(Number(id), dto);
    }

    @Delete('phase-groups/:id')
    @RequireOpenTournament({ entity: 'phase-group', location: 'params', field: 'id' })
    async delete(@Param('id') id: number): Promise<void> {
        return this.phaseGroupManager.delete(Number(id));
    }

    @Post('phase-groups/:id/entrants/:entrantId')
    @RequireOpenTournament({ entity: 'phase-group', location: 'params', field: 'id' })
    async addEntrant(@Param('id') id: number, @Param('entrantId') entrantId: number): Promise<void> {
        return this.phaseGroupManager.addEntrant(Number(id), Number(entrantId));
    }

    @Delete('phase-groups/:id/entrants/:entrantId')
    @RequireOpenTournament({ entity: 'phase-group', location: 'params', field: 'id' })
    async removeEntrant(@Param('id') id: number, @Param('entrantId') entrantId: number): Promise<void> {
        return this.phaseGroupManager.removeEntrant(Number(id), Number(entrantId));
    }

    @Patch('phase-groups/:id/entrants/seeding')
    @RequireOpenTournament({ entity: 'phase-group', location: 'params', field: 'id' })
    async updateSeeding(
        @Param('id') id: number,
        @Body(new ValidationPipe()) dto: UpdatePhaseGroupSeedingDto,
    ): Promise<void> {
        return this.phaseGroupManager.updateSeeding(Number(id), dto);
    }

}
