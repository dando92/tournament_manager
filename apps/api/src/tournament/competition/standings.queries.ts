import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DivisionStandingRowDto } from '@tournament-manager/contracts';

/** The rows `STANDINGS_OF_DIVISION` produces. Changing one without the other is a bug. */
type StandingRow = DivisionStandingRowDto;

/**
 * What every player has scored across a division, ordered by the API.
 *
 * A hand-scored round awards points without a song having been played, so a
 * standing counts towards the total either way and towards `songsPlayed` only
 * when its round has a song. That is the same rule the in-memory roll-up
 * applied; it reached it by loading the division through its phases, pools,
 * matches, results, rounds, songs, standings, scores and players, which was the
 * second-largest `relations` block in the application.
 */
const STANDINGS_OF_DIVISION = `
    SELECT  pl."id"                                              AS "id",
            pl."playerName"                                      AS "playerName",
            COALESCE(SUM(st."points"), 0)::int                    AS "points",
            COUNT(*) FILTER (WHERE r."songId" IS NOT NULL)::int   AS "songsPlayed"
    FROM        "standing" st
    JOIN        "round" r ON r."id" = st."roundId"
    JOIN        "match" m ON m."id" = r."matchId"
    JOIN        "phase_group" pg ON pg."id" = m."phaseGroupId"
    JOIN        "phase" ph ON ph."id" = pg."phaseId"
    JOIN        "player" pl ON pl."id" = st."playerId"
    WHERE       ph."divisionId" = $1
    GROUP BY    pl."id", pl."playerName"
    ORDER BY    "points" DESC, "songsPlayed" DESC, LOWER(pl."playerName"), pl."id"
`;

/** Running totals across a scope. It projects and nothing else. */
@Injectable()
export class StandingsQueries {
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) {}

    async forDivision(divisionId: number): Promise<DivisionStandingRowDto[]> {
        const rows: StandingRow[] = await this.dataSource.query(STANDINGS_OF_DIVISION, [divisionId]);

        return rows;
    }
}
