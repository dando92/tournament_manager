import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AdvancementCompetitionKind } from '@persistence/entities';
import { AdvancementRuleInputDto } from '@tournament/dtos';
import { MatchService } from '@match/services/match.service';
import { PhaseGroupService } from './phase-group.service';
import { AdvancementRuleService } from './advancement-rule.service';

@Injectable()
export class AdvancementRuleManager {
  constructor(
    private readonly advancementRuleService: AdvancementRuleService,
    private readonly matchService: MatchService,
    private readonly phaseGroupService: PhaseGroupService,
  ) {}

  async updateForSource(
    sourceKind: AdvancementCompetitionKind,
    sourceId: number,
    rules: AdvancementRuleInputDto[],
  ): Promise<void> {
    await this.assertSourceExists(sourceKind, sourceId);
    await this.advancementRuleService.deleteBySource(sourceKind, sourceId);

    for (const rule of rules ?? []) {
      await this.advancementRuleService.create({
        sourceKind,
        sourceId,
        sourcePlacement: rule.sourcePlacement,
        targetKind: rule.targetKind,
        targetId: rule.targetId,
        targetSlot: rule.targetSlot,
      });
    }
  }

  private async assertSourceExists(sourceKind: AdvancementCompetitionKind, sourceId: number): Promise<void> {
    if (sourceKind === 'match') {
      const match = await this.matchService.findOneBasic(sourceId);
      if (!match) throw new NotFoundException(`Match with ID ${sourceId} not found`);
      return;
    }

    if (sourceKind === 'phase_group') {
      const phaseGroup = await this.phaseGroupService.findOne(sourceId);
      if (!phaseGroup) throw new NotFoundException(`PhaseGroup with ID ${sourceId} not found`);
      return;
    }

    throw new BadRequestException(`Unsupported advancement rule source kind "${sourceKind}"`);
  }
}
