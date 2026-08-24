import { MigrationInterface, QueryRunner } from "typeorm";

export class ControlRoomFlows1788000000000 implements MigrationInterface {
    name = "ControlRoomFlows1788000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "control_room_flow" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'inactive', "currentEntryId" integer, "staleCode" character varying, "staleDetails" jsonb, "archivedAt" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL, "tournamentId" integer, CONSTRAINT "CHK_control_room_flow_status" CHECK ("status" IN ('inactive', 'running', 'paused', 'completed')), CONSTRAINT "PK_control_room_flow" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE TABLE "control_room_flow_entry" ("id" SERIAL NOT NULL, "position" integer NOT NULL, "flowId" integer, "matchId" integer, CONSTRAINT "PK_control_room_flow_entry" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_control_room_flow_entry_position" ON "control_room_flow_entry" ("flowId", "position")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_control_room_flow_entry_match" ON "control_room_flow_entry" ("matchId")`);
        await queryRunner.query(
            `ALTER TABLE "control_room_flow" ADD CONSTRAINT "FK_control_room_flow_tournament" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "control_room_flow_entry" ADD CONSTRAINT "FK_control_room_flow_entry_flow" FOREIGN KEY ("flowId") REFERENCES "control_room_flow"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "control_room_flow_entry" ADD CONSTRAINT "FK_control_room_flow_entry_match" FOREIGN KEY ("matchId") REFERENCES "match"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "control_room_flow" ADD CONSTRAINT "FK_control_room_flow_current_entry" FOREIGN KEY ("currentEntryId") REFERENCES "control_room_flow_entry"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "control_room_flow" DROP CONSTRAINT "FK_control_room_flow_current_entry"`);
        await queryRunner.query(`ALTER TABLE "control_room_flow_entry" DROP CONSTRAINT "FK_control_room_flow_entry_match"`);
        await queryRunner.query(`ALTER TABLE "control_room_flow_entry" DROP CONSTRAINT "FK_control_room_flow_entry_flow"`);
        await queryRunner.query(`ALTER TABLE "control_room_flow" DROP CONSTRAINT "FK_control_room_flow_tournament"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_control_room_flow_entry_match"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_control_room_flow_entry_position"`);
        await queryRunner.query(`DROP TABLE "control_room_flow_entry"`);
        await queryRunner.query(`DROP TABLE "control_room_flow"`);
    }
}
