import { Body, Controller, HttpCode, HttpStatus, Param, Put, UseGuards, ValidationPipe } from '@nestjs/common';
import { AdvancementCompetitionKind } from '@tournament-manager/persistence';
import { UpdateAdvancementRulesDto } from '@tournament/dtos';
import { AdvancementRuleManager } from '@tournament/structure/services/advancement-rule.manager';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/guards/tournament-open.guard';

@UseGuards(TournamentOpenGuard)
@Controller('advancement-rules')
export class AdvancementRulesController {
    constructor(private readonly advancementRuleManager: AdvancementRuleManager) {}

    @Put('sources/:sourceKind/:sourceId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'advancement-source', location: 'params', field: 'sourceId' })
    async updateForSource(
        @Param('sourceKind') sourceKind: AdvancementCompetitionKind,
        @Param('sourceId') sourceId: number,
        @Body(new ValidationPipe()) dto: UpdateAdvancementRulesDto,
    ): Promise<void> {
        return this.advancementRuleManager.updateForSource(sourceKind, Number(sourceId), dto.rules);
    }
}

