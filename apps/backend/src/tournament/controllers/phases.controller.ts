import { Body, Controller, Delete, Get, Param, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { Entrant, Phase } from '@persistence/entities';
import { CreatePhaseDto } from '../dtos';
import { PhaseService } from '../services/phase.service';
import { RequireOpenTournament, TournamentOpenGuard } from '../guards/tournament-open.guard';

@UseGuards(TournamentOpenGuard)
@Controller('phases')
export class PhasesController {
    constructor(private readonly phaseService: PhaseService) {}

    @Post()
    @RequireOpenTournament({ entity: 'division', location: 'body', field: 'divisionId' })
    async create(@Body(new ValidationPipe()) dto: CreatePhaseDto): Promise<Phase> {
        return this.phaseService.create(dto);
    }

    @Get(':id/entrants')
    async getDivisionEntrants(@Param('id') id: number): Promise<Entrant[]> {
        return this.phaseService.getDivisionEntrants(Number(id));
    }

    @Delete(':id')
    @RequireOpenTournament({ entity: 'phase', location: 'params', field: 'id' })
    async remove(@Param('id') id: number): Promise<void> {
        return this.phaseService.delete(id);
    }
}
