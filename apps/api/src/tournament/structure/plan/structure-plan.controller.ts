import { Body, Controller, Param, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import type { StructurePlanAppliedDto } from '@tournament-manager/contracts';

import { ApplyStructurePlanDto } from '@tournament/structure/plan/structure-plan.requests';
import { StructurePlanCommands } from '@tournament/structure/plan/structure-plan.commands';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/shared/tournament-open.guard';

/**
 * Writing a whole change of shape at once.
 *
 * One route for every producer of structure — a slot somebody typed, a bracket
 * a generator drew, an import reconciled against what is already here — because
 * they all answer with the same plan and the checks a client-supplied graph
 * needs are worth writing once.
 */
@UseGuards(TournamentOpenGuard)
@Controller('tournaments/:tournamentId/structure')
export class StructurePlanController {
    constructor(private readonly plans: StructurePlanCommands) {}

    @Post('plans')
    @RequireOpenTournament({ entity: 'tournament', location: 'params', field: 'tournamentId' })
    async apply(
        @Param('tournamentId') tournamentId: number,
        @Body(new ValidationPipe()) dto: ApplyStructurePlanDto,
    ): Promise<StructurePlanAppliedDto> {
        return this.plans.apply(Number(tournamentId), dto);
    }
}
