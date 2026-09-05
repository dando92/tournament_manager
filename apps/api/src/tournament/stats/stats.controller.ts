import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { DivisionPlacementsDto } from '@tournament-manager/contracts';

import { StatsQueries } from '@tournament/stats/stats.queries';
import { TournamentQueries } from '@tournament/management/tournament.queries';

/**
 * What a tournament's numbers are read through.
 *
 * The reads are open, because the people these answer are the competitors: a
 * final order and what was played to reach it are the public record of an event
 * that has happened.
 */
@Controller('tournaments')
export class TournamentStatsController {
    constructor(
        private readonly stats: StatsQueries,
        private readonly tournaments: TournamentQueries,
    ) {}

    /** An empty list is a tournament with no divisions, which a missing one is not. */
    private async assertExists(tournamentId: number): Promise<void> {
        if (!(await this.tournaments.byId(tournamentId))) {
            throw new NotFoundException(`Tournament ${tournamentId} not found`);
        }
    }

    @Get(':id/stats/placements')
    async placements(@Param('id') id: number): Promise<DivisionPlacementsDto[]> {
        await this.assertExists(Number(id));

        return this.stats.placementsForTournament(Number(id));
    }
}
