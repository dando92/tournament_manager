import { EntityManager } from 'typeorm';

/*
 * A statement carries at most 65 535 parameters. Half of that leaves room for
 * a wide table without having to reason about each one.
 */
const MAX_PARAMETERS = 30000;

/**
 * Bulk writing, and the reason this tool exists at all.
 *
 * A dataset worth measuring cannot be built through the domain commands: they
 * are sequential by construction, publish an event per write, and a bracket of
 * sixty-four players already costs over two hundred transactions. Here every
 * table is one multi-row `INSERT` per chunk.
 *
 * Ids are reserved from the sequence before anything is written, rather than
 * read back from `RETURNING`. A dataset is a graph — a standing points at a
 * score, a round and a player — and knowing every id up front turns building it
 * into arithmetic instead of a dependency-ordered series of round trips.
 */
export class BulkWriter {
    constructor(private readonly manager: EntityManager) {}

    /**
     * `count` ids of `table`, taken from its own sequence so nothing the seeder
     * writes can collide with a row the application writes afterwards.
     */
    async reserveIds(table: string, count: number): Promise<number[]> {
        if (count === 0) {
            return [];
        }

        const rows: Array<{ id: string }> = await this.manager.query(
            `SELECT nextval(pg_get_serial_sequence($1, 'id')) AS id FROM generate_series(1, $2)`,
            [table, count],
        );

        return rows.map((row) => Number(row.id));
    }

    /** One `INSERT` per chunk, with the columns given, in the order given. */
    async insert(table: string, columns: string[], rows: unknown[][]): Promise<void> {
        if (rows.length === 0) {
            return;
        }

        const columnList = columns.map((column) => `"${column}"`).join(', ');
        const chunkSize = Math.max(1, Math.floor(MAX_PARAMETERS / columns.length));

        for (let start = 0; start < rows.length; start += chunkSize) {
            const chunk = rows.slice(start, start + chunkSize);
            const parameters: unknown[] = [];
            const tuples = chunk.map((row) => {
                const placeholders = row.map((value) => {
                    parameters.push(value);

                    return `$${parameters.length}`;
                });

                return `(${placeholders.join(', ')})`;
            });

            await this.manager.query(`INSERT INTO "${table}" (${columnList}) VALUES ${tuples.join(', ')}`, parameters);
        }
    }
}
