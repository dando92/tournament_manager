import { Body, Controller, Param, Put, ValidationPipe } from '@nestjs/common';
import { AdvancementCompetitionKind } from '@persistence/entities';
import { UpdateAdvancementRulesDto } from '@tournament/dtos';
import { AdvancementRuleManager } from '@tournament/services/advancement-rule.manager';

@Controller('advancement-rules')
export class AdvancementRulesController {
    constructor(private readonly advancementRuleManager: AdvancementRuleManager) {}

    @Put('sources/:sourceKind/:sourceId')
    async updateForSource(
        @Param('sourceKind') sourceKind: AdvancementCompetitionKind,
        @Param('sourceId') sourceId: number,
        @Body(new ValidationPipe()) dto: UpdateAdvancementRulesDto,
    ): Promise<void> {
        return this.advancementRuleManager.updateForSource(sourceKind, Number(sourceId), dto.rules);
    }
}
