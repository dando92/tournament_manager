import { EntityManager } from 'typeorm';

/**
 * Tables the reset leaves alone: the applied migrations, and the accounts a
 * person signs in with. Everything else is data a profile is about to replace.
 */
const KEPT = ['migrations', 'account'];

/**
 * `player` is emptied by hand rather than truncated, because `account` holds a
 * foreign key to it and `TRUNCATE ... CASCADE` would take the accounts with it
 * — a truncate cascades structurally, whether or not a row points anywhere.
 */
const DELETED = ['player'];

/**
 * Empties the database so a profile writes onto a known floor.
 *
 * This is a local measurement tool and the Pre-Production Evolution Policy in
 * `AGENTS.md` says a pre-production database may be reset; it still only runs
 * when `--reset` is passed, because emptying somebody's local tournament by
 * default would be its own kind of defect.
 *
 * The table list is read from the catalogue rather than written down, so a
 * table added later is emptied without anybody remembering to come back here.
 */
export async function resetDatabase(manager: EntityManager): Promise<void> {
    const rows: Array<{ table: string }> = await manager.query(
        `SELECT table_name AS "table"
         FROM   information_schema.tables
         WHERE  table_schema = 'public' AND table_type = 'BASE TABLE'
         ORDER  BY table_name`,
    );

    const truncated = rows.map((row) => row.table).filter((table) => !KEPT.includes(table) && !DELETED.includes(table));

    await manager.query(`UPDATE "account" SET "playerId" = NULL`);
    if (truncated.length > 0) {
        await manager.query(`TRUNCATE TABLE ${truncated.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`);
    }
    for (const table of DELETED) {
        await manager.query(`DELETE FROM "${table}"`);
        await manager.query(`SELECT setval(pg_get_serial_sequence($1, 'id'), 1, false)`, [table]);
    }
}
