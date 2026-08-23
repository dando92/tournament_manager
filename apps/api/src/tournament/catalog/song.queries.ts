import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SongDto } from '@tournament-manager/contracts';

/** The rows `SONGS_OF_TOURNAMENT` produces. Changing one without the other is a bug. */
type SongRow = SongDto;

/**
 * The pool a tournament draws its rounds from.
 *
 * `group` is a reserved word in SQL and a column name here, so it is quoted like
 * every other identifier rather than being aliased away.
 */
const SONGS_OF_TOURNAMENT = `
    SELECT  s."id"         AS "id",
            s."title"      AS "title",
            s."artist"     AS "artist",
            s."difficulty" AS "difficulty",
            s."group"      AS "group"
    FROM     "song" s
    WHERE    s."tournamentId" = $1
    ORDER BY s."group", s."difficulty", LOWER(s."title"), s."id"
`;

/**
 * The songs already played somewhere in a division.
 *
 * The roller subtracts them from the pool, so a bracket does not ask a division
 * to play the same song twice. A round without a song — one scored by hand —
 * has nothing to exclude and is skipped by the join.
 */
const SONGS_PLAYED_IN_DIVISION = `
    SELECT DISTINCT r."songId" AS "songId"
    FROM        "round" r
    JOIN        "match" m       ON m."id" = r."matchId"
    JOIN        "phase_group" pg ON pg."id" = m."phaseGroupId"
    JOIN        "phase" p        ON p."id" = pg."phaseId"
    WHERE       p."divisionId" = $1
        AND     r."songId" IS NOT NULL
`;

/**
 * Every read of the song catalogue.
 *
 * It projects and nothing else. The roller loads the same songs as entities,
 * because it attaches one to a round rather than showing it, and that load
 * belongs to the write side.
 */
@Injectable()
export class SongQueries {
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) {}

    async forTournament(tournamentId: number): Promise<SongDto[]> {
        const rows: SongRow[] = await this.dataSource.query(SONGS_OF_TOURNAMENT, [tournamentId]);

        return rows;
    }

    async playedInDivision(divisionId: number): Promise<number[]> {
        const rows: Array<{ songId: number }> = await this.dataSource.query(SONGS_PLAYED_IN_DIVISION, [divisionId]);

        return rows.map((row) => row.songId);
    }
}
