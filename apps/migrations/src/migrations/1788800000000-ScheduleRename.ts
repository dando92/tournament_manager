import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Renames the control-room flow to the schedule.
 *
 * The queue a tournament runs was called a flow, and the page that operated it
 * gave the table its name. The queue is a schedule of matches, it is now read
 * by a page of its own, and the Control Room is only one of the two places that
 * shows it — so the entity takes the name of the thing rather than the name of
 * the screen. See `ScheduleRestructuring.md`.
 *
 * A rename rather than a drop and recreate: the application is pre-production
 * and the policy allows a clean baseline, but nothing here needs one. Renaming
 * keeps the rows a tester already entered, and it is the same amount of code.
 *
 * Constraint and index names travel with the table only if they are renamed
 * explicitly — PostgreSQL renames neither with `ALTER TABLE ... RENAME TO` —
 * and the parity test in `migration-runner.e2e-spec.ts` compares the schema
 * with what the entity decorators declare, so every one of them is renamed
 * here. The two sequences behind the `SERIAL` primary keys are renamed for the
 * same reason a table is: a `control_room_flow_id_seq` under a `schedule` is a
 * question somebody has to answer later.
 */
export class ScheduleRename1788800000000 implements MigrationInterface {
    name = "ScheduleRename1788800000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "control_room_flow" RENAME TO "schedule"`);
        await queryRunner.query(`ALTER TABLE "control_room_flow_entry" RENAME TO "schedule_entry"`);
        await queryRunner.query(`ALTER TABLE "schedule_entry" RENAME COLUMN "flowId" TO "scheduleId"`);

        await queryRunner.query(`ALTER TABLE "schedule" RENAME CONSTRAINT "PK_control_room_flow" TO "PK_schedule"`);
        await queryRunner.query(`ALTER TABLE "schedule" RENAME CONSTRAINT "CHK_control_room_flow_status" TO "CHK_schedule_status"`);
        await queryRunner.query(`ALTER TABLE "schedule" RENAME CONSTRAINT "FK_control_room_flow_tournament" TO "FK_schedule_tournament"`);
        await queryRunner.query(`ALTER TABLE "schedule" RENAME CONSTRAINT "FK_control_room_flow_current_entry" TO "FK_schedule_current_entry"`);
        await queryRunner.query(`ALTER TABLE "schedule_entry" RENAME CONSTRAINT "PK_control_room_flow_entry" TO "PK_schedule_entry"`);
        await queryRunner.query(`ALTER TABLE "schedule_entry" RENAME CONSTRAINT "FK_control_room_flow_entry_flow" TO "FK_schedule_entry_schedule"`);
        await queryRunner.query(`ALTER TABLE "schedule_entry" RENAME CONSTRAINT "FK_control_room_flow_entry_match" TO "FK_schedule_entry_match"`);

        await queryRunner.query(`ALTER INDEX "IDX_control_room_flow_tournament" RENAME TO "IDX_schedule_tournament"`);
        await queryRunner.query(`ALTER INDEX "IDX_control_room_flow_current_entry" RENAME TO "IDX_schedule_current_entry"`);
        await queryRunner.query(`ALTER INDEX "UQ_control_room_flow_entry_position" RENAME TO "UQ_schedule_entry_position"`);
        await queryRunner.query(`ALTER INDEX "UQ_control_room_flow_entry_match" RENAME TO "UQ_schedule_entry_match"`);

        await queryRunner.query(`ALTER SEQUENCE "control_room_flow_id_seq" RENAME TO "schedule_id_seq"`);
        await queryRunner.query(`ALTER SEQUENCE "control_room_flow_entry_id_seq" RENAME TO "schedule_entry_id_seq"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER SEQUENCE "schedule_entry_id_seq" RENAME TO "control_room_flow_entry_id_seq"`);
        await queryRunner.query(`ALTER SEQUENCE "schedule_id_seq" RENAME TO "control_room_flow_id_seq"`);

        await queryRunner.query(`ALTER INDEX "UQ_schedule_entry_match" RENAME TO "UQ_control_room_flow_entry_match"`);
        await queryRunner.query(`ALTER INDEX "UQ_schedule_entry_position" RENAME TO "UQ_control_room_flow_entry_position"`);
        await queryRunner.query(`ALTER INDEX "IDX_schedule_current_entry" RENAME TO "IDX_control_room_flow_current_entry"`);
        await queryRunner.query(`ALTER INDEX "IDX_schedule_tournament" RENAME TO "IDX_control_room_flow_tournament"`);

        await queryRunner.query(`ALTER TABLE "schedule_entry" RENAME CONSTRAINT "FK_schedule_entry_match" TO "FK_control_room_flow_entry_match"`);
        await queryRunner.query(`ALTER TABLE "schedule_entry" RENAME CONSTRAINT "FK_schedule_entry_schedule" TO "FK_control_room_flow_entry_flow"`);
        await queryRunner.query(`ALTER TABLE "schedule_entry" RENAME CONSTRAINT "PK_schedule_entry" TO "PK_control_room_flow_entry"`);
        await queryRunner.query(`ALTER TABLE "schedule" RENAME CONSTRAINT "FK_schedule_current_entry" TO "FK_control_room_flow_current_entry"`);
        await queryRunner.query(`ALTER TABLE "schedule" RENAME CONSTRAINT "FK_schedule_tournament" TO "FK_control_room_flow_tournament"`);
        await queryRunner.query(`ALTER TABLE "schedule" RENAME CONSTRAINT "CHK_schedule_status" TO "CHK_control_room_flow_status"`);
        await queryRunner.query(`ALTER TABLE "schedule" RENAME CONSTRAINT "PK_schedule" TO "PK_control_room_flow"`);

        await queryRunner.query(`ALTER TABLE "schedule_entry" RENAME COLUMN "scheduleId" TO "flowId"`);
        await queryRunner.query(`ALTER TABLE "schedule_entry" RENAME TO "control_room_flow_entry"`);
        await queryRunner.query(`ALTER TABLE "schedule" RENAME TO "control_room_flow"`);
    }
}
