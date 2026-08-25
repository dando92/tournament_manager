import { MigrationInterface, QueryRunner } from "typeorm";

export class TournamentTimelineTiming1788300000000 implements MigrationInterface {
    name = "TournamentTimelineTiming1788300000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "control_room_flow" ADD "willStartAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`UPDATE "control_room_flow" SET "willStartAt" = CURRENT_TIMESTAMP WHERE "willStartAt" IS NULL`);
        await queryRunner.query(`ALTER TABLE "control_room_flow" ALTER COLUMN "willStartAt" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "control_room_flow_entry" ADD "expectedDurationMinutes" integer NOT NULL DEFAULT 30`);
        await queryRunner.query(`ALTER TABLE "control_room_flow_entry" ALTER COLUMN "expectedDurationMinutes" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "control_room_flow_entry" ADD "startedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "control_room_flow_entry" ADD "completedAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "control_room_flow_entry" DROP COLUMN "completedAt"`);
        await queryRunner.query(`ALTER TABLE "control_room_flow_entry" DROP COLUMN "startedAt"`);
        await queryRunner.query(`ALTER TABLE "control_room_flow_entry" DROP COLUMN "expectedDurationMinutes"`);
        await queryRunner.query(`ALTER TABLE "control_room_flow" DROP COLUMN "willStartAt"`);
    }
}
