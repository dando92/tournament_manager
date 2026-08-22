import { Injectable, NotFoundException } from '@nestjs/common';
import { DivisionSummaryDto } from '@tournament-manager/contracts';
import { toEntrantDto } from '@tournament/shared/projections';
import { DivisionService } from './division.service';
import { AdvancementRuleService } from './advancement-rule.service';

@Injectable()
export class DivisionManager {
    constructor(
        private readonly divisionService: DivisionService,
        private readonly advancementRuleService: AdvancementRuleService,
    ) {}

    async findSummary(id: number): Promise<DivisionSummaryDto> {
        const division = await this.divisionService.findOneForSummary(id);
        if (!division) throw new NotFoundException(`Division ${id} not found`);

        const phaseGroupIds = (division.phases ?? []).flatMap((phase) => (phase.phaseGroups ?? []).map((phaseGroup) => phaseGroup.id));
        const phaseGroupRules = await this.advancementRuleService.findBySources('phase_group', phaseGroupIds);

        return {
            id: division.id,
            name: division.name,
            entrants: (division.entrants ?? []).map(toEntrantDto),
            phases: (division.phases ?? []).map((phase) => ({
                id: phase.id,
                name: phase.name,
                matchCount: (phase.phaseGroups ?? []).reduce((count, phaseGroup) => count + (phaseGroup.matches?.length ?? 0), 0),
                phaseGroups: (phase.phaseGroups ?? []).map((phaseGroup) => ({
                    id: phaseGroup.id,
                    name: phaseGroup.name,
                    displayIdentifier: phaseGroup.displayIdentifier ?? null,
                    bracketType: phaseGroup.bracketType ?? null,
                    state: phaseGroup.state,
                    matchCount: phaseGroup.matches?.length ?? 0,
                    entrants: [],
                    advancementRules: phaseGroupRules
                        .filter((rule) => rule.sourceKind === 'phase_group' && rule.sourceId === phaseGroup.id)
                        .map((rule) => ({
                            id: rule.id,
                            sourceKind: rule.sourceKind,
                            sourceId: rule.sourceId,
                            sourcePlacement: rule.sourcePlacement,
                            targetKind: rule.targetKind,
                            targetId: rule.targetId,
                            targetSlot: rule.targetSlot,
                        })),
                })),
            })),
        };
    }
}
