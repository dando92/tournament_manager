import { Body, Controller, Delete, Get, Param, Patch, Post, ValidationPipe } from '@nestjs/common';
import {
    CreatePhaseGroupDto,
    UpdatePhaseGroupDto,
    UpdatePhaseGroupSeedingDto,
} from '@tournament/dtos';
import { DivisionSummaryPhaseGroupDto } from '@tournament/dtos/division-summary.dto';
import { PhaseGroupManager } from '@tournament/services';

@Controller()
export class PhaseGroupsController {
    constructor(private readonly phaseGroupManager: PhaseGroupManager) {}

    @Get('phases/:phaseId/phase-groups')
    async findByPhase(@Param('phaseId') phaseId: number): Promise<DivisionSummaryPhaseGroupDto[]> {
        return this.phaseGroupManager.findByPhase(Number(phaseId));
    }

    @Post('phases/:phaseId/phase-groups')
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
    async update(
        @Param('id') id: number,
        @Body(new ValidationPipe()) dto: UpdatePhaseGroupDto,
    ): Promise<DivisionSummaryPhaseGroupDto> {
        return this.phaseGroupManager.update(Number(id), dto);
    }

    @Delete('phase-groups/:id')
    async delete(@Param('id') id: number): Promise<void> {
        return this.phaseGroupManager.delete(Number(id));
    }

    @Post('phase-groups/:id/entrants/:entrantId')
    async addEntrant(@Param('id') id: number, @Param('entrantId') entrantId: number): Promise<void> {
        return this.phaseGroupManager.addEntrant(Number(id), Number(entrantId));
    }

    @Delete('phase-groups/:id/entrants/:entrantId')
    async removeEntrant(@Param('id') id: number, @Param('entrantId') entrantId: number): Promise<void> {
        return this.phaseGroupManager.removeEntrant(Number(id), Number(entrantId));
    }

    @Patch('phase-groups/:id/entrants/seeding')
    async updateSeeding(
        @Param('id') id: number,
        @Body(new ValidationPipe()) dto: UpdatePhaseGroupSeedingDto,
    ): Promise<void> {
        return this.phaseGroupManager.updateSeeding(Number(id), dto);
    }

}
