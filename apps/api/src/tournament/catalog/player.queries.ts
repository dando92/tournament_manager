import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PlayerRefDto } from '@tournament-manager/contracts';

/** The rows `ALL_PLAYERS` produces. Changing one without the other is a bug. */
type PlayerRow = PlayerRefDto;

/**
 * Everybody the application knows, by the name they compete under.
 *
 * The catalogue is application-wide rather than per tournament, which is what
 * makes a person the same person in the next one. The route used to answer with
 * the entity, so a caller received the relations TypeORM decided to include and
 * the frontend typed it as this projection anyway.
 */
const ALL_PLAYERS = `
    SELECT   pl."id"          AS "id",
             pl."playerName"  AS "playerName",
             pl."nationality" AS "nationality"
    FROM     "player" pl
    ORDER BY LOWER(pl."playerName"), pl."id"
`;

/**
 * Every read of the player catalogue.
 *
 * It projects and nothing else. Matching a name against the catalogue is a
 * write's question rather than a screen's, so it lives in `PlayerStore` with
 * the rows the answer is written from.
 */
@Injectable()
export class PlayerQueries {
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) {}

    async all(): Promise<PlayerRefDto[]> {
        const rows: PlayerRow[] = await this.dataSource.query(ALL_PLAYERS);

        return rows;
    }
}
