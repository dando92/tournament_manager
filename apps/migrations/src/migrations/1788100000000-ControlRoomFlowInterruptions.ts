import { MigrationInterface, QueryRunner } from "typeorm";

export class ControlRoomFlowInterruptions1788100000000 implements MigrationInterface {
    name = "ControlRoomFlowInterruptions1788100000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "control_room_flow" ADD "interruptionCode" character varying`);
        await queryRunner.query(`ALTER TABLE "control_room_flow" ADD "interruptionDetails" jsonb`);
        await queryRunner.query(`ALTER TABLE "control_room_flow" ADD "interruptedAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "control_room_flow" DROP COLUMN "interruptedAt"`);
        await queryRunner.query(`ALTER TABLE "control_room_flow" DROP COLUMN "interruptionDetails"`);
        await queryRunner.query(`ALTER TABLE "control_room_flow" DROP COLUMN "interruptionCode"`);
    }
}
