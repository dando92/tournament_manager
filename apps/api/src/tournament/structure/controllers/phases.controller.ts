import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { CreatedResourceDto } from '@tournament-manager/contracts';
import { CreatePhaseDto, UpdatePhaseDto } from '@tournament/dtos';
import { PhaseService } from '../services/phase.service';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/guards/tournament-open.guard';

@UseGuards(TournamentOpenGuard)
@Controller('phases')
export class PhasesController {
    constructor(private readonly phaseService: PhaseService) {}

    @Post()
    @RequireOpenTournament({ entity: 'division', location: 'body', field: 'divisionId' })
    async create(@Body(new ValidationPipe()) dto: CreatePhaseDto): Promise<CreatedResourceDto> {
        const phase = await this.phaseService.createWithDefaultPhaseGroup(dto);

        return { id: phase.id };
    }

    @Patch(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'phase', location: 'params', field: 'id' })
    async update(@Param('id') id: number, @Body(new ValidationPipe()) dto: UpdatePhaseDto): Promise<void> {
        await this.phaseService.update(Number(id), dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'phase', location: 'params', field: 'id' })
    async remove(@Param('id') id: number): Promise<void> {
        return this.phaseService.delete(id);
    }
}

