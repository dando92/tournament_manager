import { MigrationInterface, QueryRunner } from 'typeorm';

export class SimplifyEventEnvelope1787085404086 implements MigrationInterface {
  name = 'SimplifyEventEnvelope1787085404086';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "event_outbox" WHERE "published_at" IS NULL`);
    await queryRunner.query(`ALTER TABLE "event_outbox" DROP COLUMN "event_version"`);
    await queryRunner.query(`ALTER TABLE "event_outbox" DROP COLUMN "occurred_at"`);
    await queryRunner.query(`ALTER TABLE "event_outbox" DROP COLUMN "correlation_id"`);
    await queryRunner.query(`ALTER TABLE "event_outbox" DROP COLUMN "causation_id"`);
    await queryRunner.query(`ALTER TABLE "event_inbox" DROP COLUMN "event_type"`);
    await queryRunner.query(`ALTER TABLE "event_inbox" DROP COLUMN "correlation_id"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "event_inbox" ADD "correlation_id" uuid`);
    await queryRunner.query(`UPDATE "event_inbox" SET "correlation_id" = "event_id"`);
    await queryRunner.query(`ALTER TABLE "event_inbox" ALTER COLUMN "correlation_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "event_inbox" ADD "event_type" character varying NOT NULL DEFAULT 'unknown'`);
    await queryRunner.query(`ALTER TABLE "event_outbox" ADD "causation_id" uuid`);
    await queryRunner.query(`ALTER TABLE "event_outbox" ADD "correlation_id" uuid`);
    await queryRunner.query(`UPDATE "event_outbox" SET "correlation_id" = "id"`);
    await queryRunner.query(`ALTER TABLE "event_outbox" ALTER COLUMN "correlation_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "event_outbox" ADD "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "event_outbox" ADD "event_version" integer NOT NULL DEFAULT 1`);
  }
}
