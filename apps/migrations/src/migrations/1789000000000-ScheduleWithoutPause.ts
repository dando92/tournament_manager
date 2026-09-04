import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Removes the paused state of a schedule.
 *
 * A schedule runs or it does not. Waiting — for a player, for a song, for
 * somebody to finish elsewhere — is something a running schedule does and the
 * board already says so, which left `paused` as a second way of being stopped
 * that no rule distinguished from the first.
 *
 * The rows are normalized before the check constraint is tightened, and the
 * matches of a paused schedule are taken out of the active state with them: a
 * paused schedule kept its match active, and after this migration no schedule
 * would own it. A stopped schedule keeps `currentEntryId`, so where the run had
 * got to is not lost — `start` walks from the beginning and stops there again
 * on its own.
 */
export class ScheduleWithoutPause1789000000000 implements MigrationInterface {
    name = "ScheduleWithoutPause1789000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "match" m
            SET    "active" = FALSE
            FROM   "schedule_entry" entry
            JOIN   "schedule" s ON s."id" = entry."scheduleId"
            WHERE  entry."matchId" = m."id" AND s."status" = 'paused' AND m."active" = TRUE
        `);
        await queryRunner.query(`UPDATE "schedule" SET "status" = 'inactive' WHERE "status" = 'paused'`);
        await queryRunner.query(`ALTER TABLE "schedule" DROP CONSTRAINT "CHK_schedule_status"`);
        await queryRunner.query(`ALTER TABLE "schedule" ADD CONSTRAINT "CHK_schedule_status" CHECK ("status" IN ('inactive', 'running', 'completed'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "schedule" DROP CONSTRAINT "CHK_schedule_status"`);
        await queryRunner.query(`ALTER TABLE "schedule" ADD CONSTRAINT "CHK_schedule_status" CHECK ("status" IN ('inactive', 'running', 'paused', 'completed'))`);
    }
}
