import { Body, Controller, Delete, Get, Param, Post, ValidationPipe } from '@nestjs/common';
import { Entrant, Phase } from '@persistence/entities';
import { CreatePhaseDto } from '../dtos';
import { PhaseService } from '../services/phase.service';

@Controller('phases')
export class PhasesController {
    constructor(private readonly phaseService: PhaseService) {}

    @Post()
    async create(@Body(new ValidationPipe()) dto: CreatePhaseDto): Promise<Phase> {
        return this.phaseService.create(dto);
    }

    @Get(':id/entrants')
    async getDivisionEntrants(@Param('id') id: number): Promise<Entrant[]> {
        return this.phaseService.getDivisionEntrants(Number(id));
    }

    @Delete(':id')
    async remove(@Param('id') id: number): Promise<void> {
        return this.phaseService.delete(id);
    }
}
