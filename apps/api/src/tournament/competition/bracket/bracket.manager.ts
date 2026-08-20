import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { BracketSystemProvider } from "@bracket/BracketSystemProvider";
import { GenerateDivisionBracketDto } from "@tournament/dtos";
import { DivisionService } from "@tournament/structure/services/division.service";
import { PhaseGroupService } from "@tournament/structure/services/phase-group.service";
import { PhaseService } from "@tournament/structure/services/phase.service";

@Injectable()
export class BracketManager {
    constructor(
        @Inject()
        private readonly bracketSystemProvider: BracketSystemProvider,
        @Inject()
        private readonly phaseGroupService: PhaseGroupService,
        @Inject()
        private readonly divisionService: DivisionService,
        @Inject()
        private readonly phaseService: PhaseService,
    ) { }

    getBracketTypes(): string[] {
        return this.bracketSystemProvider.getAll();
    }

    async generateForPhaseGroup(phaseGroupId: number, bracketType: string, playerPerMatch: number): Promise<void> {
        const phaseGroup = await this.phaseGroupService.findOne(phaseGroupId);
        if (!phaseGroup) {
            throw new Error(`PhaseGroup ${phaseGroupId} not found`);
        }

        const entrants = await this.phaseGroupService.getEntrantsForBracket(phaseGroupId);
        const phase = phaseGroup.phase;
        const division = phase.division;
        const system = this.bracketSystemProvider.getBracketSystem(bracketType);
        await system.generateForExistingPhaseGroup(division, phase, phaseGroup, entrants, playerPerMatch);
    }

    async generateForDivision(
        divisionId: number,
        dto: GenerateDivisionBracketDto,
    ): Promise<{ phaseId: number; phaseGroupId: number }> {
        const division = await this.divisionService.findOneForBracketGeneration(divisionId);
        if (!division) {
            throw new Error(`Division ${divisionId} not found`);
        }

        const entrants = (division.entrants ?? []).filter((entrant) => entrant.status === 'active');
        if (entrants.length === 0) {
            throw new BadRequestException('Cannot generate a bracket without active entrants.');
        }

        const nextPhaseNumber = (division.phases?.length ?? 0) + 1;
        const phase = await this.phaseService.create({
            divisionId,
            name: dto.phaseName?.trim() || `Bracket ${nextPhaseNumber}`,
        });
        const phaseGroup = await this.phaseGroupService.createForPhase(phase.id, {
            name: phase.name,
            displayIdentifier: '1',
            bracketType: dto.bracketType,
        });
        await this.phaseGroupService.replaceEntrants(phaseGroup.id, entrants);
        await this.generateForPhaseGroup(phaseGroup.id, dto.bracketType, dto.playerPerMatch ?? 2);

        return {
            phaseId: phase.id,
            phaseGroupId: phaseGroup.id,
        };
    }
}
