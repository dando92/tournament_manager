import { EntityManager } from 'typeorm';

import { poolSize } from './dataset';
import type { ExistingState, ExistingTournament } from './dataset';
import type { Options } from './options';

/**
 * Reads what the database already holds, so a run can continue an installation
 * rather than restate it.
 *
 * Every run appends unless it was told to reset, and this is what makes the
 * second one land somewhere sensible: the tournaments already there number the
 * next one and offset the generator, the cabinets are topped up instead of
 * duplicated, and a run extending one tournament reads its people, its songs
 * and whether a board is already running.
 */
export async function readExistingState(manager: EntityManager, options: Options): Promise<ExistingState> {
    const [{ tournaments }] = await manager.query(`SELECT COUNT(*)::int AS "tournaments" FROM "tournament"`);
    const [{ setups }] = await manager.query(`SELECT COUNT(*)::int AS "setups" FROM "setup"`);
    /* Bounded by the field this run will enter. A `stress` database holds tens
       of thousands of people and the run needs a few thousand of them; reading
       the table would be work nobody asked for. The newest are taken because
       they are the ones the last run brought in, which keeps consecutive runs
       overlapping rather than drawing from opposite ends of the history. */
    const players: Array<{ id: number }> = await manager.query(`SELECT "id" FROM "player" ORDER BY "id" DESC LIMIT $1`, [poolSize(options.profile)]);

    return {
        tournaments: Number(tournaments),
        setups: Number(setups),
        players: players.map((row) => Number(row.id)),
        target: options.into === null ? null : await readTournament(manager, options.into),
    };
}

async function readTournament(manager: EntityManager, into: number | 'last'): Promise<ExistingTournament> {
    const rows: Array<{ id: number; name: string; status: string }> =
        into === 'last'
            ? await manager.query(`SELECT "id", "name", "status" FROM "tournament" ORDER BY "id" DESC LIMIT 1`)
            : await manager.query(`SELECT "id", "name", "status" FROM "tournament" WHERE "id" = $1`, [into]);

    if (rows.length === 0) {
        throw new Error(into === 'last' ? 'The database holds no tournament to add to.' : `No tournament with id ${into}.`);
    }
    /* A closed tournament has been decided. Adding matches to it would produce
       a shape the application never writes and cannot reach. */
    if (rows[0].status !== 'open') {
        throw new Error(`Tournament ${rows[0].id} ("${rows[0].name}") is ${rows[0].status}; only an open tournament can be added to.`);
    }

    const id = Number(rows[0].id);
    const participants: Array<{ playerId: number; participantId: number }> = await manager.query(
        `SELECT "playerId", "id" AS "participantId" FROM "participant" WHERE "tournamentId" = $1 ORDER BY "id"`,
        [id],
    );
    const songs: Array<{ id: number }> = await manager.query(`SELECT "id" FROM "song" WHERE "tournamentId" = $1 ORDER BY "id"`, [id]);
    const [{ running }] = await manager.query(
        `SELECT COUNT(*)::int AS "running" FROM "schedule" WHERE "tournamentId" = $1 AND "status" = 'running'`,
        [id],
    );

    console.log(`Adding to tournament ${id} ("${rows[0].name}"): ${participants.length} people entered, ${songs.length} songs.`);

    return {
        id,
        participants: new Map(participants.map((row) => [Number(row.playerId), Number(row.participantId)])),
        songs: songs.map((row) => Number(row.id)),
        hasRunningSchedule: Number(running) > 0,
    };
}
