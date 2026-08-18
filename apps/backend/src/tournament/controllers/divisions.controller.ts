import { Body, Controller, Delete, Get, Param, Patch, Post, Query, ValidationPipe } from '@nestjs/common';
import { BracketManager } from '@bracket/bracket.manager';
import { Division, Entrant } from '@persistence/entities';
import { CreateDivisionDto, DivisionStandingRowDto, DivisionSummaryDto, GenerateDivisionBracketDto, UpdateDivisionDto } from '../dtos';
import { DivisionManager } from '../services/division.manager';
import { DivisionService } from '../services/division.service';
import { EntrantService } from '../services/entrant.service';

@Controller('divisions')
export class DivisionsController {
    constructor(
        private readonly divisionService: DivisionService,
        private readonly divisionManager: DivisionManager,
        private readonly entrantService: EntrantService,
        private readonly bracketManager: BracketManager,
    ) {}

    @Post()
    async create(@Body(new ValidationPipe()) dto: CreateDivisionDto): Promise<Division> {
        return this.divisionService.create(dto);
    }

    @Get()
    async findAll(@Query('tournamentId') tournamentId?: string): Promise<Division[]> {
        return this.divisionService.findAll(tournamentId ? Number(tournamentId) : undefined);
    }

    @Get(':id/summary')
    async findSummary(@Param('id') id: number): Promise<DivisionSummaryDto> {
        return this.divisionManager.findSummary(Number(id));
    }

    @Get(':id/standings')
    async findStandings(@Param('id') id: number): Promise<DivisionStandingRowDto[]> {
        return this.divisionManager.findStandings(Number(id));
    }

    @Post(':id/generate-bracket')
    async generateBracket(
        @Param('id') id: number,
        @Body(new ValidationPipe()) dto: GenerateDivisionBracketDto,
    ): Promise<{ phaseId: number; phaseGroupId: number }> {
        return this.bracketManager.generateForDivision(Number(id), dto);
    }

    @Get(':id')
    async findOne(@Param('id') id: number): Promise<Division> {
        return this.divisionService.findOne(id);
    }

    @Patch(':id')
    async update(@Param('id') id: number, @Body(new ValidationPipe()) dto: UpdateDivisionDto): Promise<Division> {
        return this.divisionService.update(id, dto);
    }

    @Delete(':id')
    async remove(@Param('id') id: number): Promise<void> {
        return this.divisionService.delete(id);
    }

    @Get(':id/entrants')
    async getEntrants(@Param('id') id: number): Promise<Entrant[]> {
        return this.divisionService.getEntrants(id);
    }

    @Get(':id/available-participants')
    async getAvailableParticipants(@Param('id') id: number) {
        return this.divisionService.getAvailableParticipants(Number(id));
    }

    @Post(':id/participants/:participantId')
    async addParticipantToDivision(
        @Param('id') id: number,
        @Param('participantId') participantId: number,
    ): Promise<Entrant> {
        return this.entrantService.addSinglesEntrant(Number(id), Number(participantId));
    }

    @Delete(':id/participants/:participantId')
    async removeParticipantFromDivision(
        @Param('id') id: number,
        @Param('participantId') participantId: number,
    ): Promise<void> {
        return this.entrantService.removeSinglesEntrantByParticipant(Number(id), Number(participantId));
    }

}
