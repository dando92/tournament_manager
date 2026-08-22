import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { BracketManager } from '@bracket/bracket.manager';
import { Division, Entrant } from '@tournament-manager/persistence';
import { DivisionStandingRowDto, DivisionSummaryDto, GenerateBracketResultDto } from '@tournament-manager/contracts';
import { CreateDivisionDto, GenerateDivisionBracketDto, UpdateDivisionDto, UpdateDivisionSeedingDto } from '@tournament/dtos';
import { DivisionManager } from '../services/division.manager';
import { DivisionService } from '../services/division.service';
import { EntrantService } from '@tournament/services/entrant.service';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/guards/tournament-open.guard';

@UseGuards(TournamentOpenGuard)
@Controller('divisions')
export class DivisionsController {
    constructor(
        private readonly divisionService: DivisionService,
        private readonly divisionManager: DivisionManager,
        private readonly entrantService: EntrantService,
        private readonly bracketManager: BracketManager,
    ) {}

    @Post()
    @RequireOpenTournament({ entity: 'tournament', location: 'body', field: 'tournamentId' })
    async create(@Body(new ValidationPipe()) dto: CreateDivisionDto): Promise<Division> {
        return this.divisionService.create(dto);
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
    @RequireOpenTournament({ entity: 'division', location: 'params', field: 'id' })
    async generateBracket(
        @Param('id') id: number,
        @Body(new ValidationPipe()) dto: GenerateDivisionBracketDto,
    ): Promise<GenerateBracketResultDto> {
        return this.bracketManager.generateForDivision(Number(id), dto);
    }

    @Patch(':id')
    @RequireOpenTournament({ entity: 'division', location: 'params', field: 'id' })
    async update(@Param('id') id: number, @Body(new ValidationPipe()) dto: UpdateDivisionDto): Promise<Division> {
        return this.divisionService.update(id, dto);
    }

    @Delete(':id')
    @RequireOpenTournament({ entity: 'division', location: 'params', field: 'id' })
    async remove(@Param('id') id: number): Promise<void> {
        return this.divisionService.delete(id);
    }

    @Get(':id/entrants')
    async getEntrants(@Param('id') id: number): Promise<Entrant[]> {
        return this.divisionService.getEntrants(id);
    }

    @Patch(':id/entrants/seeding')
    @RequireOpenTournament({ entity: 'division', location: 'params', field: 'id' })
    async updateSeeding(
        @Param('id') id: number,
        @Body(new ValidationPipe()) dto: UpdateDivisionSeedingDto,
    ): Promise<void> {
        return this.divisionService.updateSeeding(Number(id), dto.entrantIds);
    }

    @Get(':id/available-participants')
    async getAvailableParticipants(@Param('id') id: number) {
        return this.divisionService.getAvailableParticipants(Number(id));
    }

    @Post(':id/participants/:participantId')
    @RequireOpenTournament({ entity: 'division', location: 'params', field: 'id' })
    async addParticipantToDivision(
        @Param('id') id: number,
        @Param('participantId') participantId: number,
    ): Promise<Entrant> {
        return this.entrantService.addSinglesEntrant(Number(id), Number(participantId));
    }

    @Delete(':id/participants/:participantId')
    @RequireOpenTournament({ entity: 'division', location: 'params', field: 'id' })
    async removeParticipantFromDivision(
        @Param('id') id: number,
        @Param('participantId') participantId: number,
    ): Promise<void> {
        return this.entrantService.removeSinglesEntrantByParticipant(Number(id), Number(participantId));
    }

}

