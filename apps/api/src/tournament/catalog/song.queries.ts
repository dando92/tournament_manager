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
}
