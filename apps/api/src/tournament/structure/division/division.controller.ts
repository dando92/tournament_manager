import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { BracketManager } from '@bracket/bracket.manager';
import { Division, Entrant } from '@tournament-manager/persistence';
import {
    DivisionStandingRowDto,
    DivisionSummaryDto,
    EntrantDto,
    GenerateBracketResultDto,
    ParticipantDto,
} from '@tournament-manager/contracts';
import { CreateDivisionDto, GenerateDivisionBracketDto, UpdateDivisionDto, UpdateDivisionSeedingDto } from '@tournament/dtos';
import { DivisionService } from '../services/division.service';
import { DivisionQueries } from '@tournament/structure/division/division.queries';
import { TreeQueries } from '@tournament/structure/tree.queries';
import { StandingsQueries } from '@tournament/competition/standings.queries';
import { EntrantService } from '@tournament/services/entrant.service';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/guards/tournament-open.guard';

@UseGuards(TournamentOpenGuard)
@Controller('divisions')
export class DivisionsController {
    constructor(
        private readonly divisionQueries: DivisionQueries,
        private readonly treeQueries: TreeQueries,
        private readonly standingsQueries: StandingsQueries,
        private readonly divisionService: DivisionService,
        private readonly entrantService: EntrantService,
        private readonly bracketManager: BracketManager,
    ) {}

    /** The three read routes below answer `404` for a division that does not exist, which an empty collection cannot say. */
    private async assertExists(divisionId: number): Promise<void> {
        if (!(await this.divisionQueries.exists(divisionId))) throw new NotFoundException(`Division ${divisionId} not found`);
    }

    @Post()
    @RequireOpenTournament({ entity: 'tournament', location: 'body', field: 'tournamentId' })
    async create(@Body(new ValidationPipe()) dto: CreateDivisionDto): Promise<Division> {
        return this.divisionService.create(dto);
    }

    @Get(':id/summary')
    async findSummary(@Param('id') id: number): Promise<DivisionSummaryDto> {
        const division = await this.treeQueries.forDivision(Number(id));
        if (!division) throw new NotFoundException(`Division ${id} not found`);
        return division;
    }

    @Get(':id/standings')
    async findStandings(@Param('id') id: number): Promise<DivisionStandingRowDto[]> {
        await this.assertExists(Number(id));
        return this.standingsQueries.forDivision(Number(id));
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
    async getEntrants(@Param('id') id: number): Promise<EntrantDto[]> {
        await this.assertExists(Number(id));
        return this.divisionQueries.entrants(Number(id));
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
    async getAvailableParticipants(@Param('id') id: number): Promise<ParticipantDto[]> {
        await this.assertExists(Number(id));
        return this.divisionQueries.availableParticipants(Number(id));
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

