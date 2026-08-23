import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AdvancementCompetitionKind } from '@tournament-manager/persistence';
import { AdvancementRuleInputDto } from '@tournament/dtos';
import { MatchQueries } from '@match/match.queries';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';
import { PhaseGroupQueries } from '@tournament/structure/phase-group/phase-group.queries';
import { AdvancementRuleService } from './advancement-rule.service';

/**
 * The rules that say where the entrants of a competition go next.
 *
 * A rule is an edge between two competitions rather than a part of either, so
 * it has no aggregate and no address of its own. It announces the pool its
 * source sits in, because that is the read a rule changes: the tree draws the
 * rules leaving each pool, and the match list draws the ones leaving each match.
 * Until it did, writing a rule published nothing and the interface had to
 * re-read the division and the match list by hand.
 */
@Injectable()
export class AdvancementRuleManager {
  constructor(
    private readonly advancementRuleService: AdvancementRuleService,
    private readonly matchQueries: MatchQueries,
    private readonly phaseGroupQueries: PhaseGroupQueries,
    private readonly publisher: UiUpdatePublisher,
  ) {}

  async updateForSource(
    sourceKind: AdvancementCompetitionKind,
    sourceId: number,
    rules: AdvancementRuleInputDto[],
  ): Promise<void> {
    await this.assertSourceExists(sourceKind, sourceId);
    await this.advancementRuleService.deleteBySource(sourceKind, sourceId);
    await this.advancementRuleService.createAll(
      (rules ?? []).map((rule) => ({
        sourceKind,
        sourceId,
        sourcePlacement: rule.sourcePlacement,
        targetKind: rule.targetKind,
        targetId: rule.targetId,
        targetSlot: rule.targetSlot,
      })),
    );

    await this.announce(sourceKind, sourceId);
  }

  private async assertSourceExists(sourceKind: AdvancementCompetitionKind, sourceId: number): Promise<void> {
    if (sourceKind === 'match') {
      if (!(await this.matchQueries.exists(sourceId))) throw new NotFoundException(`Match with ID ${sourceId} not found`);
      return;
    }

    if (sourceKind === 'phase_group') {
      if (!(await this.phaseGroupQueries.exists(sourceId))) throw new NotFoundException(`PhaseGroup with ID ${sourceId} not found`);
      return;
    }

    throw new BadRequestException(`Unsupported advancement rule source kind "${sourceKind}"`);
  }

  private async announce(sourceKind: AdvancementCompetitionKind, sourceId: number): Promise<void> {
    const address = sourceKind === 'match'
      ? await this.phaseGroupQueries.addressOfMatchPool(sourceId)
      : await this.phaseGroupQueries.address(sourceId);
    if (!address) return;

    await this.publisher.emitPhaseGroupUpdate(address);
  }
}
