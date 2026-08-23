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

/** The rows `ROLLABLE_SONGS` produces: what a roll picks from. */
type RollableRow = { id: number; difficulty: number };

/**
 * What a division may still be asked to play: the tournament's pool, minus
 * every song already played somewhere in that division.
 *
 * A bracket does not ask a division to play the same song twice, whichever pool
 * or match it was played in. Collecting that used to be two reads — the whole
 * pool as entities, and the set of songs the division had played — and the
 * roller subtracted one from the other in memory. It is one query, and it
 * carries the two columns a roll decides on rather than every column of a song.
 *
 * A round without a song — one scored by hand — has nothing to exclude and is
 * skipped by the join. A `NULL` group asks for the whole pool.
 */
const ROLLABLE_SONGS = `
    SELECT  s."id"         AS "id",
            s."difficulty" AS "difficulty"
    FROM    "song" s
    WHERE   s."tournamentId" = $1
        AND ($3::text IS NULL OR s."group" = $3)
        AND NOT EXISTS (
            SELECT  1
            FROM    "round" r
            JOIN    "match" m        ON m."id"  = r."matchId"
            JOIN    "phase_group" pg ON pg."id" = m."phaseGroupId"
            JOIN    "phase" p        ON p."id"  = pg."phaseId"
            WHERE   p."divisionId" = $2 AND r."songId" = s."id"
        )
    ORDER BY s."id"
`;

/**
 * The song of a tournament's pool with one title.
 *
 * The lobby reports what it played by path, and the pool is keyed by title, so
 * this is the join between the two. What happens when a title is not in the
 * pool is recorded as FQ-021.
 */
const SONG_OF_TOURNAMENT_BY_TITLE = `
    SELECT   s."id" AS "id"
    FROM     "song" s
    WHERE    s."tournamentId" = $1 AND s."title" = $2
    ORDER BY s."id"
    LIMIT    1
`;

/**
 * Every read of the song catalogue.
 *
 * It projects and nothing else. Two of the three reads answer a write rather
 * than a screen: a roll asks what the division may still play, and the lobby
 * ingestion asks which song a reported title is. Neither loads a song entity,
 * because neither of them writes one — the round the song ends up on is loaded
 * and saved by the match.
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

    async rollable(tournamentId: number, divisionId: number, group: string | null): Promise<RollableRow[]> {
        return await this.dataSource.query(ROLLABLE_SONGS, [tournamentId, divisionId, group ?? null]);
    }

    async idByTitle(tournamentId: number, title: string): Promise<number | null> {
        const rows: Array<{ id: number }> = await this.dataSource.query(SONG_OF_TOURNAMENT_BY_TITLE, [tournamentId, title]);

        return rows[0]?.id ?? null;
    }
}
